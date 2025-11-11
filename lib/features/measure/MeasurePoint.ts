import mapboxgl from "mapbox-gl";
import { creator } from 'wheater';
import MeasureBase, { MeasureOptions, MeasureType } from "./MeasureBase";

// oe: 
// 使用 declare 关键字声明要在 Typescript 中调用已在 Javascript 中定义的全局变量或函数
declare const dotNetHelpers: any;
let that: MeasurePoint;
export function showElevation(elevation: number): void {
    alert(`Elevation: ${elevation}`);
}

export interface MeasurePointOptions extends MeasureOptions<GeoJSON.Point> {

    circlePaintBuilder?: (paint: mapboxgl.CirclePaint) => void;
    symbolLayoutBuilder?: (layout: mapboxgl.SymbolLayout) => void;
    symbolPaintBuilder?: (paint: mapboxgl.SymbolPaint) => void;

    /**
     * 文字创建
     */
    createText?: (lng: number, lat: number, elevation: number) => string
    /**
     * 查询高程所使用的数据来源：gmrt/idsse/mapbox，不设置则不显示高程
     */
    elevationSource?: "gmrt" | "idsse" | "mapbox" | undefined;
}

export default class MeasurePoint extends MeasureBase {
    readonly type: MeasureType = 'Point';

    /**
     *
     */
    constructor(map: mapboxgl.Map, private options: MeasurePointOptions = {}) {
        options.createText ??= (lng: number, lat: number, elevation: number) => {
            if (elevation === 99999)
                return `经度：${lng.toFixed(6)}°\r\n纬度：${lat.toFixed(6)}°`;
            else
                return `经度：${lng.toFixed(6)}°\r\n纬度：${lat.toFixed(6)}°\r\n高程：${elevation.toFixed(1)}米`;
        };
        super(map, options);
        that = this;
    }

    protected onInit(): void {
        const circlePaint: mapboxgl.CirclePaint = {
            'circle-color': "#fbb03b",
            'circle-radius': 4
        };
        this.options.circlePaintBuilder?.call(undefined, circlePaint);
        this.layerGroup.add({
            id: this.id,
            type: 'circle',
            source: this.id,
            layout: {},
            paint: circlePaint
        });

        const symbolLayout: mapboxgl.SymbolLayout = {
            "text-field": ['get', 'coord'],
            'text-offset': [0, 0],
            'text-size': 12,
            'text-justify': 'left',
            'text-radial-offset': 1.2,
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            "text-font": ["literal", ['Arial Unicode MS Regular', 'DIN Offc Pro Italic', 'Open Sans Regular']],
        };
        const symbolPaint: mapboxgl.SymbolPaint = {
            'text-color': "#000000",
            'text-halo-color': '#ffffff',
            'text-halo-width': 1
        }

        this.options.symbolLayoutBuilder?.call(undefined, symbolLayout);
        this.options.symbolPaintBuilder?.call(undefined, symbolPaint)

        this.layerGroup.add({
            id: this.id + "_label",
            type: 'symbol',
            source: this.id,
            layout: symbolLayout,
            paint: symbolPaint
        })
    }

    protected onStart(): void {
        this.map.on('click', this.onMapClickHandle);
    }

    protected onStop(): void {
        this.map.off('click', this.onMapClickHandle);
    }

    protected onClear(): void {

    }

    /**
     * 通过鼠标点击处的经纬度，查询高程。
     * @param lnglat 鼠标点击处的经纬度
     * @returns 鼠标点击处的高程
     */
    async queryElevation(lnglat: mapboxgl.LngLat): Promise<any> {
        const { lng, lat } = lnglat;
        if (this.options.elevationSource === "gmrt")
            return (await (await fetch(`https://www.gmrt.org/services/pointserver.php?latitude=${lat}&longitude=${lng}&statsoff=true`))?.json());
        else if (this.options.elevationSource == "idsse") {
            let offset = 0.00001;
            let minx = lng - offset;
            let miny = lat - offset;
            let maxx = lng + offset;
            let maxy = lat + offset;
            var bbox = `${minx},${miny},${maxx},${maxy}`;
            var url = `${window.location.protocol}//${window.location.hostname}:9801/tiles/geoserver/wms/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&FORMAT=image/jpeg&TRANSPARENT=true&QUERY_LAYERS=ne:gmrt_20231018&STYLES&LAYERS=ne:gmrt_20231018&exceptions=application/vnd.ogc.se_inimage&INFO_FORMAT=application/json&FEATURE_COUNT=50&X=50&Y=50&SRS=EPSG:4326&WIDTH=101&HEIGHT=101&BBOX=${bbox}`;
            return (await (await fetch(url))?.json())?.features[0]?.properties?.GRAY_INDEX?.toFixed(1) ?? "N/A";
        }
        else if (this.options.elevationSource == "mapbox") {
            var url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${lng},${lat}.json?layers=contour&access_token=${mapboxgl.accessToken}`;
            return (await (await fetch(url))?.json())?.features[0]?.properties?.ele?.toFixed(1) ?? "N/A";
        }
        else
            return 99999;
    }

    // oe: 弃用：因为 addElevationMarker 为静态方法，对应拥有多个 mapbox 对象时，只在最后的 mapbox 对象上有效。
    // static addElevationMarker(lng: number, lat: number, elevation: number): void {
    // 改为非静态函数
    private addElevationMarker(lng: number, lat: number, elevation: number): void {
        const id = creator.uuid();
        this.geojson.features.push({
            type: 'Feature',
            id,
            geometry: {
                type: 'Point',
                coordinates: [lng, lat],
            },
            properties: {
                "coord": this.options.createText!(lng, lat, elevation),
                id
            }
        });

        this.options.onDrawed?.call(this, id, this.geojson.features.at(-1)!.geometry as GeoJSON.Point);

        this.updateGeometryDataSource();
    }

    private onMapClickHandle = async (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
        // let elevation = await this.queryElevation(e.lngLat);
        // oe: 解决 addElevationMarker 为静态方法无法有效响应多个 mapbox 对象的问题
        let helper = dotNetHelpers["Mapbox"];
        if (!helper)
            helper = dotNetHelpers["cliwoc"];
        let elevation = await helper.invokeMethodAsync("QueryDepth", e.lngLat.lng, e.lngLat.lat);
        // console.log(`[${e.lngLat.lng.toFixed(6)}, ${e.lngLat.lat.toFixed(6)}]: ${elevation.toFixed(1)}m`);
        this.addElevationMarker(e.lngLat.lng, e.lngLat.lat, elevation);
    }
}