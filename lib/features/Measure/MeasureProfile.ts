import mapboxgl from "mapbox-gl";
import { creator } from 'wheater';
import MeasureBase, { MeasureOptions, MeasureType } from "./MeasureBase";

// oe: 
// 使用 declare 关键字声明要在 Typescript 中调用已在 Javascript 中定义的全局变量或函数
declare const dotNetHelper: any;
declare const showProfile: any;
declare const depthIndex: any;
declare let woaDepthLon: any;
declare let woaDepthLat: any;
declare let woaLayerOn: any;
declare let woaProfileOn: any;
declare let velocityLayerOn: any;
declare let velocityProfileOn: any;

let that: MeasureProfile;
export function showElevation(elevation: number): void {
    alert(`Elevation: ${elevation}`);
}

export interface MeasureProfileOptions extends MeasureOptions<GeoJSON.Point> {

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

export default class MeasureProfile extends MeasureBase {
    readonly type: MeasureType = 'Profile';

    /**
     *
     */
    constructor(map: mapboxgl.Map, private options: MeasureProfileOptions = {}) {
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
            'circle-radius': 5
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
            'text-offset': [0, 2.5],
            'text-size': 10,
            'text-justify': 'left',
            'text-radial-offset': 1.8,
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
        woaProfileOn = true;
        document.getElementById("depthIndexSelector")!.style.display = document.getElementById("depthIndexValue")!.style.display = "";

        this.map.on('click', this.onMapClickHandle);
    }

    protected onStop(): void {
        woaProfileOn = false;
        if (!woaLayerOn && !woaProfileOn)
            document.getElementById("depthIndexSelector")!.style.display = document.getElementById("depthIndexValue")!.style.display = "none";

        this.map.off('click', this.onMapClickHandle);
    }

    protected onClear(): void {

    }

    // oe: 显示高程数据
    static addProfileMarker(lng: number, lat: number, elevation: number): void {
        const id = creator.uuid();
        that.geojson.features.push({
            type: 'Feature',
            id,
            geometry: {
                type: 'Point',
                coordinates: [lng, lat],
            },
            properties: {
                "coord": that.options.createText!(lng, lat, elevation),
                id
            }
        });

        that.options.onDrawed?.call(this, id, that.geojson.features.at(-1)!.geometry as GeoJSON.Point);

        that.updateGeometryDataSource();
    }

    private onMapClickHandle = async (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
        woaDepthLon = e.lngLat.lng;
        woaDepthLat = e.lngLat.lat;
        // oe: 显示剖面曲线图
        //showProfile(e.lngLat.lng, e.lngLat.lat);
        await dotNetHelper.invokeMethodAsync("ShowWoaData", e.lngLat.lng, e.lngLat.lat, depthIndex)
        // 临时禁用
        // await dotNetHelper.invokeMethodAsync("ShowVelocityData", e.lngLat.lng, e.lngLat.lat, depthIndex)
    }
}