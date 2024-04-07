import mapboxgl from "mapbox-gl";
import centroid from '@turf/centroid';
import bbox from '@turf/bbox';
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { dom, array, creator, deep } from 'wheater';
import { svg, language } from "../../common";
import LayerGroup from "../LayerGroup";
import { createConfirmModal, createExportModal, createFeaturePropertiesEditModal, createMarkerLayerEditModel } from "./Modal";
import { GeometryStyle, MarkerFeatrueProperties, MarkerFeatureType, MarkerLayerProperties } from "./types";
import DrawManager from "./DrawMarker";
import Importer from "./importer/Importer";

const { lang } = language;
const { SvgBuilder } = svg;

// oe: 使用 declare 关键字声明要在 Typescript 中调用已在 Javascript 中定义的全局变量或函数
declare const dotNetHelper: any;
declare const saveLayer: any;

// oe: 要从数据库中删除的图层
let layersToDeleted: any = [];
export { layersToDeleted };

interface MarkerItemOptions {
    onCreate?(feature: MarkerFeatureType): void,
    onRemove?(feature: MarkerFeatureType): void,
    onUpdate?(feature: MarkerFeatureType): void
}

interface MarkerLayerOptions {
    onCreate?(properties: MarkerLayerProperties): void,
    onRemove?(properties: MarkerLayerProperties): void,
    onRename?(properties: MarkerLayerProperties): void,

    markerItemOptions?: MarkerItemOptions,

    extraInfo?(feature: GeoJSON.Feature): string | Node | undefined,
}

export interface MarkerManagerOptions {
    layers?: MarkerLayerProperties[],
    featureCollection?: GeoJSON.FeatureCollection<GeoJSON.Geometry, MarkerFeatrueProperties>,
    drawAfterOffset?: [number, number],
    layerOptions?: MarkerLayerOptions,
    geoEditor?: MapboxDraw,
    firstFeatureStyleConfig?(style: Omit<GeometryStyle, "pointIcon">): void,
}

export default class MarkerManager {
    private readonly layerContainer: HTMLElement;

    readonly htmlElement;
    readonly extendHeaderSlot = dom.createHtmlElement('div');

    readonly markerLayers: MarkerLayer[] = [];
    readonly geoEditor: MapboxDraw;

    /**
     * 绘制管理器
     */
    private readonly drawManger: DrawManager;

    /**
     * 搜索缓存，避免重复搜索
     */
    private lastSearchValue?: string;

    /**
     * 标记属性编辑缓存，为下一次创建标记做准备
     */
    private lastFeaturePropertiesCache: MarkerFeatrueProperties;

    /**
     *
     */
    constructor(
        private map: mapboxgl.Map,
        readonly options: MarkerManagerOptions = {}) {

        options.featureCollection ??= { type: 'FeatureCollection', features: [] };
        options.layerOptions ??= {};

        // 无图层，新建默认图层
        if (!options.layers || options.layers.length === 0) {
            const layer = {
                id: creator.uuid(),
                name: lang.defaltLayerName,
                date: Date.now() - 1704038400000
            };
            options.layers = [layer];
            options.layerOptions?.onCreate?.call(undefined, layer);
        }

        // 标注缓存，用于填充下一次标注
        this.lastFeaturePropertiesCache = {
            id: creator.uuid(),
            // oe: 不使用上次的标注
            name: "",//lang.newMarkerName,
            layerId: options.layers[0].id,
            date: Date.now() - 1704038400000,
            style: {
                textSize: 12,
                textColor: 'red',
                textHaloColor: 'white',
                textHaloWidth: 1,

                pointIcon: "标1.png",
                pointIconColor: "#ff0000",
                pointIconSize: 0.3,

                lineColor: 'blue',
                lineWidth: 1,

                polygonColor: '#fff',
                polygonOpacity: 0.1,
                polygonOutlineColor: 'blue',
                polygonOutlineWidth: 1,
            }
        };

        options.firstFeatureStyleConfig?.call(undefined, this.lastFeaturePropertiesCache.style);

        // 创建绘制管理器
        this.drawManger = new DrawManager(map, {
            onDrawFinish: (draw, flush) => {
                const feature = draw.currentFeature!;
                const orgCenter = map.getCenter();
                const center = centroid(feature as any);
                // 临时禁用
                // map.easeTo({
                //     center: center.geometry.coordinates as [number, number],
                //     'offset': this.options.drawAfterOffset
                // });

                createFeaturePropertiesEditModal(feature, {
                    mode: 'create',
                    layers: this.markerLayers.map(x => x.properties),
                    onConfirm: () => {
                        this.addMarker(feature);
                        this.lastFeaturePropertiesCache = deep.clone(feature.properties);
                        flush();
                        // 临时禁用
                        // map.easeTo({
                        //     center: orgCenter
                        // });
                    },
                    onCancel: () => {
                        flush();
                        // 临时禁用
                        // map.easeTo({
                        //     center: orgCenter
                        // });
                    },
                    onPropChange: () => draw.update()
                });
            },
            // oe: 处理用户粘贴的坐标
            onPasteStart: (draw, flush) => {
                alert("onPasteStart");
                const feature = draw.currentFeature!;
                const orgCenter = map.getCenter();
                const center = centroid(feature as any);
                // 临时禁用
                // map.easeTo({
                //     center: center.geometry.coordinates as [number, number],
                //     'offset': this.options.drawAfterOffset
                // });

                createFeaturePropertiesEditModal(feature, {
                    mode: 'create',
                    layers: this.markerLayers.map(x => x.properties),
                    onConfirm: () => {
                        this.addMarker(feature);
                        this.lastFeaturePropertiesCache = deep.clone(feature.properties);
                        flush();
                        // 临时禁用
                        // map.easeTo({
                        //     center: orgCenter
                        // });
                    },
                    onCancel: () => {
                        flush();
                        // 临时禁用
                        // map.easeTo({
                        //     center: orgCenter
                        // });
                    },
                    onPropChange: () => draw.update()
                });
            }
        });

        //#region 图形编辑器

        //防止MapboxDraw内部自动修改doubleClickZoom
        map.doubleClickZoom.disable();

        if (options.geoEditor) {
            this.geoEditor = options.geoEditor
        } else {
            // 创建编辑器
            this.geoEditor = new MapboxDraw({
                controls: {
                    trash: true
                },
                displayControlsDefault: false
            });
            this.geoEditor.onAdd(map);
            // 禁止图形平移
            const onDrag = MapboxDraw.modes.direct_select.onDrag;
            MapboxDraw.modes.direct_select.onDrag = function (this, state, e) {
                if (state.selectedCoordPaths.length > 0)
                    onDrag?.call(this, state, e);
            };
            // 禁止删除图形
            const directSelectOnTrash = MapboxDraw.modes.direct_select.onTrash;
            MapboxDraw.modes.direct_select.onTrash = function (this, state) {
                const featureType = state.feature.type;
                const coordinates = state.feature.coordinates;
                if ((featureType === 'Polygon' && coordinates[0].length > 3) ||
                    (featureType === 'LineString' && coordinates.length > 2)
                ) {
                    directSelectOnTrash?.call(this, state);
                }
            }
            MapboxDraw.modes.simple_select.onTrash = function (this, _) { }
        }

        //#endregion

        // 图层通过时间排序、创建图层、图层初始设置不可见
        const values = array.groupBy(options.featureCollection.features, f => f.properties.layerId);
        options.layers.sort(x => x.date).forEach(l => {
            const features = values.get(l.id) || [];
            this.markerLayers.push(new MarkerLayer(this, map, l, features, options.layerOptions));
        });
        this.setGeometryVisible(false);

        // 装载html
        this.htmlElement = dom.createHtmlElement('div', ['jas-ctrl-marker']);
        this.layerContainer = dom.createHtmlElement('div', ['jas-ctrl-marker-data'], this.markerLayers.map(x => x.htmlElement));

        const header = dom.createHtmlElement('div', ['jas-ctrl-marker-header'], [
            //this.createHeaderSearch(),// oe: HeaderSearch 单独占一行
            this.createHeaderAddLayer(),
            this.createHeaderDrawBtn()
        ]);

        this.htmlElement.append(header, this.layerContainer);
        // oe: HeaderSearch 单独占一行
        this.htmlElement.append(this.createHeaderSearch(), header, this.layerContainer);
    }

    private createHeaderSearch() {
        const searchDiv = dom.createHtmlElement('div', ['jas-flex-center', 'jas-ctrl-marker-headre-search']);
        searchDiv.style.position = 'relative';
        const search = dom.createHtmlElement('input');
        search.type = 'text';
        search.placeholder = lang.searchPlaceholder;
        search.style.padding = '6px 18px 6px 6px';
        search.style.outline = 'none';
        search.style.border = '1px solid #ddd';
        search.style.borderRadius = '4px';

        const clean = new SvgBuilder('X').resize(17, 17).create('svg');
        clean.style.position = 'absolute';
        clean.style.right = '2px';
        clean.style.cursor = 'pointer';

        clean.addEventListener('click', () => {
            search.value = '';
            this.search();
        });

        let searchTimeout: NodeJS.Timeout | undefined;
        search.addEventListener('input', _ => {
            if (searchTimeout)
                clearInterval(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.search(search.value);
                searchTimeout = undefined;
            }, 100);
        });

        searchDiv.append(search, clean);

        return searchDiv;
    }

    private createHeaderDrawBtn() {
        const btnPoint = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);
        const btnLine = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);
        const btnPolygon = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);
        const btnRectangle = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);
        const btnCircle = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);

        // 设置 title
        btnPoint.title = lang.point;
        btnLine.title = lang.line;
        btnPolygon.title = lang.polygon;
        btnRectangle.title = lang.rectangle;
        btnCircle.title = lang.circle;

        // 设置 图标
        const svgBuilder = new SvgBuilder('marker_point');
        btnPoint.innerHTML = svgBuilder.resize(22, 22).create();
        btnLine.innerHTML = svgBuilder.change('marker_line').create();
        // oe:
        // btnPolygon.innerHTML = `<img src="../assets/svg/polygon.svg"/>`//svgBuilder.resize(21, 21).change('marker_polygon').create();
        // btnRectangle.innerHTML =`<img src="../assets/svg/rectangle.svg"/>`;svgBuilder.resize(21, 21).change('marker_rectangle').create();
        // btnCircle.innerHTML = `<img src="../assets/svg/circle.svg"/>`;//svgBuilder.resize(21, 21).change('marker_circle').create();
        btnPolygon.innerHTML = `<img src="_content/IDSSE.OceanExplorer.Shared/images/svg/polygon.svg"/>`//svgBuilder.resize(21, 21).change('marker_polygon').create();
        btnRectangle.innerHTML = `<img src="_content/IDSSE.OceanExplorer.Shared/images/svg/rectangle.svg"/>`; svgBuilder.resize(21, 21).change('marker_rectangle').create();
        btnCircle.innerHTML = `<img src="_content/IDSSE.OceanExplorer.Shared/images/svg/circle.svg"/>`;//svgBuilder.resize(21, 21).change('marker_circle').create();


        // 绑定click，开始绘制
        btnPoint.addEventListener('click', () => this.drawManger.start('Point', deep.clone(this.lastFeaturePropertiesCache)));
        btnLine.addEventListener('click', () => this.drawManger.start('LineString', deep.clone(this.lastFeaturePropertiesCache)));
        btnPolygon.addEventListener('click', () => this.drawManger.start('Polygon', deep.clone(this.lastFeaturePropertiesCache)));
        btnRectangle.addEventListener('click', () => this.drawManger.start('Rectangle', deep.clone(this.lastFeaturePropertiesCache)));
        // btnCircle.addEventListener('click', () => this.drawManger.start('Circle', deep.clone(this.lastFeaturePropertiesCache)));
        btnCircle.addEventListener('click', () => { this.drawManger.start('Circle', deep.clone(this.lastFeaturePropertiesCache)) });

        const c = dom.createHtmlElement('div', ["jas-flex-center", "jas-ctrl-marker-btns-container"]);
        c.append(btnPoint, btnLine, btnPolygon, btnRectangle, btnCircle);

        return c;
    }

    private createHeaderAddLayer() {
        // const div = dom.createHtmlElement('div', ["jas-ctrl-marker-btns-container", "jas-ctrl-marker-item-btn"]);
        const btnAddLayer = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);
        const btnSaveLayer = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);
        const btnRestoreLayer = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);

        // 设置 title
        btnAddLayer.title = lang.newLayer;
        btnSaveLayer.title = lang.saveLayer;
        btnRestoreLayer.title = lang.restoreLayer;

        // 设置 图标
        btnAddLayer.innerHTML = new SvgBuilder('add').resize(25, 25).create();
        btnSaveLayer.innerHTML = `<img src="_content/IDSSE.OceanExplorer.Shared/images/save.png"/>`;
        btnRestoreLayer.innerHTML = `<img src="_content/IDSSE.OceanExplorer.Shared/images/restore.png"/>`;

        btnAddLayer.addEventListener('click', () => {
            const layer: MarkerLayerProperties = {
                id: creator.uuid(),
                date: Date.now() - 1704038400000,
                name: lang.newLayer
            }
            createMarkerLayerEditModel(layer, {
                mode: 'create',
                onConfirm: () => {
                    this.addLayer(layer);
                }
            })
        });

        // oe: 在 typescript/javascript 中调用 .NET 中的函数
        // dotNetHelper.invokeMethodAsync("TestAlert", "call .NET method in javascript.");
        // 将图层（图层属性及其上的所有 features）存入数据库
        btnSaveLayer.addEventListener('click', () => saveLayer());
        // 从数据库加载图层
        btnRestoreLayer.addEventListener('click', () => dotNetHelper.invokeMethodAsync("FetchLayers"));

        const c = dom.createHtmlElement('div', ["jas-flex-center", "jas-ctrl-marker-btns-container"]);
        c.append(btnAddLayer, btnSaveLayer);
        return c;

        // return div;
    }

    search(value?: string) {
        if (this.lastSearchValue === value)
            return;

        this.markerLayers.forEach(l => {
            if (value) {
                let hitCount = 0;
                l.items.forEach(m => {
                    const isHit = m.feature.properties.name.includes(value);
                    m.setUIVisible(isHit);
                    if (isHit)
                        hitCount++;
                });
                l.setUIVisible(hitCount > 0);
                l.collapse(hitCount === 0)
            } else {
                // 复原操作
                l.setUIVisible(true);
                l.collapse(true);
                l.items.forEach(m => {
                    m.setUIVisible(true);
                });
            }
        });

        this.lastSearchValue = value;
    }

    addLayer(layer: MarkerLayerProperties) {
        this.options?.layerOptions?.onCreate?.call(undefined, layer);
        const markerLayer = new MarkerLayer(this, this.map, layer, [], this.options.layerOptions);
        this.markerLayers.push(markerLayer);
        this.layerContainer.append(markerLayer.htmlElement);
    }

    addMarker(feature: MarkerFeatureType) {
        const layer = array.first(this.markerLayers, x => x.properties.id === feature.properties.layerId);
        if (!layer) throw Error(`layer id : ${feature.properties.layerId} not found`);

        layer.addMarker(feature);
    }

    setGeometryVisible(value: boolean) {
        this.markerLayers.forEach(l => {
            l.setGeometryVisible(value);

            // 图层移到最上层
            if (value) l.moveTo();
            this.drawManger.moveTo();
        });
    }

    destroy() {
        this.drawManger.destroy();
        this.markerLayers.forEach(l => {
            l.destroy();
        });
    }
}

abstract class AbstractLinkP<P> {

    /**
     *
     */
    constructor(readonly parent: P) {

    }
}

class MarkerLayer extends AbstractLinkP<MarkerManager> {
    readonly items: MarkerItem[];
    readonly htmlElement = dom.createHtmlElement('div');

    private layerGroup: LayerGroup;
    private arrow = dom.createHtmlElement('div', ["jas-collapse-arrow", "jas-ctrl-switchlayer-group-header-title-collapse"]);
    private nameElement = dom.createHtmlElement('div');
    private itemContainerElement = dom.createHtmlElement('div', ['jas-ctrl-hidden']);

    declare setGeometryVisible: (value: boolean) => void;

    /**
     *
     */
    constructor(
        parent: MarkerManager,
        private map: mapboxgl.Map,
        readonly properties: MarkerLayerProperties,
        features: MarkerFeatureType[],
        private options: MarkerLayerOptions = {}) {

        super(parent);

        const fm = array.groupBy(features, f => f.geometry.type);
        const layerFeatures =
            ((fm.get('Point') || []).concat(fm.get('MultiPoint') || [])).sort(x => x.properties.date).reverse().concat(
                ((fm.get('LineString') || []).concat(fm.get('MultiLineString') || [])).sort(x => x.properties.date).reverse()).concat(
                    ((fm.get('Polygon') || []).concat(fm.get('MultiPolygon') || [])).sort(x => x.properties.date).reverse());

        this.items = layerFeatures.map(f => new MarkerItem(this, map, f, options.markerItemOptions));

        map.addSource(this.properties.id, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features
            }
        });

        this.layerGroup = new LayerGroup(creator.uuid(), map, [
            {
                id: this.properties.id + "_point",
                type: 'symbol',
                source: this.properties.id,
                layout: {
                    "text-field": ['get', 'name'],
                    'text-size': ['get', 'textSize', ['get', 'style']],
                    'icon-image': ['get', 'pointIcon', ['get', 'style']],
                    'icon-size': ['get', 'pointIconSize', ['get', 'style']],
                    'text-justify': 'auto',
                    'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
                    'text-radial-offset': ['*', ['get', 'pointIconSize', ['get', 'style']], 4],
                },
                paint: {
                    "text-color": ['get', 'textColor', ['get', 'style']],
                    "text-halo-width": ['get', 'textHaloWidth', ['get', 'style']],
                    "text-halo-color": ['get', 'textHaloColor', ['get', 'style']],
                    'icon-color': ['get', 'pointIconColor', ['get', 'style']]
                },
                filter: ['==', '$type', 'Point']
            }, {
                id: this.properties.id + "_line",
                type: 'line',
                source: this.properties.id,
                layout: {
                },
                paint: {
                    "line-color": ['get', 'lineColor', ['get', 'style']],
                    "line-width": ['get', 'lineWidth', ['get', 'style']]
                },
                filter: ['==', '$type', 'LineString']
            }, {
                id: this.properties.id + '_polygon',
                type: 'fill',
                source: this.properties.id,
                layout: {
                },
                paint: {
                    "fill-color": ['get', 'polygonColor', ['get', 'style']],
                    "fill-opacity": ['get', 'polygonOpacity', ['get', 'style']]
                },
                filter: ['==', '$type', 'Polygon']
            }, {
                id: this.properties.id + '_polygon_outline',
                type: 'line',
                source: this.properties.id,
                layout: {},
                paint: {
                    "line-color": ['get', 'polygonOutlineColor', ['get', 'style']],
                    "line-width": ['get', 'polygonOutlineWidth', ['get', 'style']]
                },
                filter: ['==', '$type', 'Polygon']
            }, {
                id: this.properties.id + "_label",
                type: 'symbol',
                source: this.properties.id,
                layout: {
                    "text-field": ['get', 'name'],
                    'text-size': ['get', 'textSize', ['get', 'style']]
                },
                paint: {
                    "text-color": ['get', 'textColor', ['get', 'style']],
                    "text-halo-width": ['get', 'textHaloWidth', ['get', 'style']],
                    "text-halo-color": ['get', 'textHaloColor', ['get', 'style']],
                },
                filter: ['!=', '$type', 'Point']
            }
        ]);

        map.on('mouseenter', this.layerGroup.layerIds, _ => {
            if (map.getCanvas().style.cursor === '')
                map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', this.layerGroup.layerIds, _ => {
            if (map.getCanvas().style.cursor === 'pointer')
                map.getCanvas().style.cursor = ''
        });

        map.on('click', this.layerGroup.layerIds, e => {
            const feature = e.features?.at(0) as MarkerFeatureType | undefined;
            if (!feature) return;

            const item = array.first(this.items, x => x.feature.properties.id === feature.properties.id);
            if (!item) return;

            const center = centroid(feature as any).geometry.coordinates as [number, number];
            // 临时禁用
            //map.easeTo({ center });
            const controls = item.createSuffixElement({ editGeometry: true });
            const popupContent = dom.createHtmlElement('div', [], [controls]);

            if (options.extraInfo) {
                const info = options.extraInfo(item.feature);
                if (info)
                    popupContent.append(dom.createHtmlElement('div',
                        ["jas-ctrl-marker-item-extra-info"],
                        [info]));
            }

            const popup = new mapboxgl.Popup({
                closeOnClick: true,
                closeButton: false
            })
                .setLngLat(center)
                .setDOMContent(popupContent)
                .addTo(map);

            controls.addEventListener('click', () => {
                popup.remove();
            });
        });

        this.nameElement.innerText = properties.name;
        this.itemContainerElement.append(...this.items.map(x => x.htmlElement));
        this.itemContainerElement.style.paddingLeft = '16px';
        this.htmlElement.append(this.createHeader(), this.itemContainerElement);
    }

    addMarker(feature: MarkerFeatureType) {
        this.options?.markerItemOptions?.onCreate?.call(undefined, feature);

        const markerItem = new MarkerItem(this, this.map, feature, this.options.markerItemOptions);
        const firstNode = this.itemContainerElement.querySelector(`.${MarkerItem.getGeometryMatchClass(feature)}`)

        if (firstNode)
            this.itemContainerElement.insertBefore(markerItem.htmlElement, firstNode);
        else
            this.itemContainerElement.append(markerItem.htmlElement);

        this.items.push(markerItem);

        this.updateDataSource();
    }

    remove() {
        this.options.onRemove?.call(undefined, this.properties);
        const index = this.parent.markerLayers.indexOf(this);
        this.parent.markerLayers.splice(index, 1);
        this.htmlElement.remove();
        this.map.removeLayerGroup(this.layerGroup.id);
        // oe: 删除图层
        layersToDeleted.push({ id: this.properties.id, name: this.properties.name });
        console.log(`将从数据库中删除图层：${this.properties.id}:${this.properties.name}`);
    }

    updateDataSource() {
        (this.map.getSource(this.properties.id) as mapboxgl.GeoJSONSource)
            .setData({ type: 'FeatureCollection', features: this.items.map(x => x.feature) });
    }
    // oe: 
    setDataSource(geojson: any) {
        (this.map.getSource(this.properties.id) as mapboxgl.GeoJSONSource)
            .setData(geojson);
    }
    collapse(value: boolean) {
        if (value) {
            this.arrow.classList.remove("jas-collapse-active");
            this.itemContainerElement.classList.add("jas-ctrl-hidden");
        } else {
            this.arrow.classList.add("jas-collapse-active");
            this.itemContainerElement.classList.remove("jas-ctrl-hidden");
        }
    }

    setUIVisible(value: boolean) {
        if (value)
            this.htmlElement.classList.remove('jas-ctrl-hidden');
        else
            this.htmlElement.classList.add('jas-ctrl-hidden');
    }

    moveTo(beforeId?: string) {
        this.layerGroup.moveTo(beforeId);
    }

    destroy() {
        this.map.removeLayerGroup(this.layerGroup.id);
    }

    private createHeader() {
        const header = dom.createHtmlElement('div', ['jas-ctrl-marker-layer-header']);

        const content = dom.createHtmlElement('div', ['jas-ctrl-marker-layer-header-content']);
        content.append(this.arrow, this.nameElement);

        content.addEventListener('click', () => {
            this.arrow.classList.toggle("jas-collapse-active");
            this.itemContainerElement.classList.toggle("jas-ctrl-hidden");
        });

        const suffix = dom.createHtmlElement('div', ['jas-ctrl-marker-suffix', 'jas-ctrl-hidden']);

        // oe: 用于控制以 this.properties.name 命名的图层，这样该图层可不设置 markerOptions.featureCollection.features
        let nameLayer = this.map.getLayer(this.properties.name);
        // 基础图层禁用编辑/导入/导出/删除按钮
        if (!nameLayer) {
            suffix.append(
                this.createSuffixEdit(),
                this.createSuffixImport(),
                this.createSuffixExport(),
                this.createSuffixDel());
        }

        header.addEventListener('mouseenter', () => {
            suffix.classList.remove('jas-ctrl-hidden');
        });
        header.addEventListener('mouseleave', () => {
            suffix.classList.add('jas-ctrl-hidden');
        });

        header.append(content, suffix, this.createSuffixVisible());
        return header;
    }

    private createSuffixExport() {
        const exp = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);
        exp.innerHTML = new SvgBuilder('export').resize(15, 15).create();
        exp.title = lang.exportItem;

        exp.addEventListener('click', () => {
            createExportModal(this.properties.name, {
                type: 'FeatureCollection',
                features: this.items.map(x => x.feature)
            });
        })

        return exp
    }

    private createSuffixImport() {
        const importUI = dom.createHtmlElement('input', [], [], {
            attributes: {
                type: "file",
                accept: ".kml,.kmz"
            }
        });

        importUI.onchange = async e => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                if (file.name.endsWith('kml') || file.name.endsWith('kmz')) {
                    const t = await file.text();
                    const fc = await new Importer('kml').import(this.properties.id, t);
                    if (fc.features.length > 0) {
                        fc.features.forEach(f => this.addMarker(f));

                        const b = bbox(fc);
                        this.map.fitBounds([b[0], b[1], b[2], b[3]], { padding: 100 });
                        this.collapse(false);
                    }
                }
            }

            // 处理input file不能重复上传
            importUI.type = "text";
            importUI.type = "file";
        }

        const imp = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"], [
            new SvgBuilder('import').resize(15, 15).create('svg')
        ], {
            attributes: {
                title: lang.importItem
            },
            onClick: () => {
                importUI.click();
            }
        });

        return imp;
    }

    private createSuffixEdit() {
        const edit = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);
        edit.innerHTML = new SvgBuilder('edit').resize(18, 18).create();
        edit.title = lang.editItem;
        edit.addEventListener('click', () => {
            createMarkerLayerEditModel(this.properties, {
                mode: 'update',
                onConfirm: () => {
                    this.options.onRename?.call(undefined, this.properties);
                    this.nameElement.innerText = this.properties.name;
                }
            });
        });
        return edit;
    }

    private createSuffixDel() {
        const del = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);
        del.innerHTML = new SvgBuilder('delete').resize(15, 15).create();
        del.title = lang.deleteItem;

        del.addEventListener('click', () => {
            if (this.parent.markerLayers.length < 2)
                createConfirmModal({
                    title: lang.warn,
                    content: lang.cannotDeleteLastLayer,
                    withCancel: false,
                });
            else
                createConfirmModal({
                    title: lang.deleteItem,
                    content: `${this.properties.name}`,
                    onConfirm: () => {
                        this.remove();
                    }
                });
        });

        return del;
    }

    private createSuffixVisible() {
        const svgBuilder = new SvgBuilder('eye').resize(18, 18);
        const eye = svgBuilder.create();
        const uneye = svgBuilder.change('uneye').create();

        const visible = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);

        // oe: 对于基础图层（海岸线、专属经济区）通过设置 show 属性来控制图层的显隐
        let nameLayer = this.map.getLayer(this.properties.name);
        if (nameLayer) {
            let visibility = this.map.getLayoutProperty(this.properties.name, "visibility");
            visible.innerHTML = visibility === "visible" ? eye : uneye;
        }
        else
            visible.innerHTML = eye;

        visible.addEventListener('click', () => {
            const isEye = visible.innerHTML === eye;
            visible.innerHTML = isEye ? uneye : eye;
            this.layerGroup.show = !isEye;

            // oe: 用于控制以 this.properties.name 命名的图层，即基础图层（海岸线、专属经济区），这样该图层可不设置 markerOptions.featureCollection.features，显隐功能直接应用于图层
            let nameLayer = this.map.getLayer(this.properties.name);
            if (nameLayer)
                this.map.setLayoutProperty(this.properties.name, "visibility", this.layerGroup.show ? "visible" : "none");
        });

        this.setGeometryVisible = (value: boolean) => {
            // oe: 对于基础图层（海岸线、专属经济区）已通过设置 show 属性来控制图层的显隐
            // visible.innerHTML = value ? eye : uneye;
            // this.layerGroup.show = value;
        }

        visible.style.cursor = "pointer";
        visible.style.marginLeft = "5px";
        visible.title = lang.visibility;
        return visible;
    }
}

class MarkerItem extends AbstractLinkP<MarkerLayer> {
    readonly htmlElement = dom.createHtmlElement('div', ['jas-ctrl-marker-item-container']);
    readonly reName: (name: string) => void;

    /**
     *
     */
    constructor(
        parent: MarkerLayer,
        private map: mapboxgl.Map,
        readonly feature: MarkerFeatureType,
        private options: MarkerItemOptions = {}) {

        if (!feature.id) feature.id = feature.properties.id;
        super(parent);

        this.htmlElement.classList.add(...MarkerItem.getGeometryMatchClasses(feature));

        const prefix = dom.createHtmlElement('div', ['jas-flex-center']);
        const suffix = this.createSuffixElement();
        suffix.classList.add('jas-ctrl-hidden');
        const content = dom.createHtmlElement('div', ['jas-ctrl-marker-item-container-content']);
        content.innerText = feature.properties.name;

        this.reName = (name: string) => content.innerText = name;

        content.addEventListener('click', () => {
            // 临时禁用
            return;
            const box = bbox(this.feature as any);
            map.fitBounds([box[0], box[1], box[2], box[3]], {
                maxZoom: 20,
                padding: 50
            });
        });

        const svgBuilder = new SvgBuilder('marker_point').resize(16, 16);
        const geometryType = feature.geometry.type;
        const geometryTypeElement = geometryType === 'Point' || geometryType === 'MultiPoint' ?
            svgBuilder.create('svg') :
            geometryType === 'LineString' || geometryType === 'MultiLineString' ?
                svgBuilder.change('marker_line').create('svg') :
                svgBuilder.change('marker_polygon').create('svg');
        prefix.append(geometryTypeElement);

        this.htmlElement.addEventListener('mouseenter', () => {
            suffix.classList.remove('jas-ctrl-hidden');
        });
        this.htmlElement.addEventListener('mouseleave', () => {
            suffix.classList.add('jas-ctrl-hidden');
        });

        this.htmlElement.append(prefix, content, suffix);
    }

    static getGeometryMatchClass(feature: GeoJSON.Feature) {
        return `geometry-match-${feature.geometry.type.toLocaleLowerCase()}`;
    }

    static getGeometryMatchClasses(featrue: GeoJSON.Feature) {
        const geoType = featrue.geometry.type;
        if (geoType === 'Point' || geoType === 'MultiPoint')
            return [`geometry-match-point`];
        else if (geoType === 'LineString' || geoType === 'MultiLineString')
            return [`geometry-match-point`, `geometry-match-linestring`];
        else if (geoType === 'Polygon' || geoType === 'MultiPolygon')
            return [`geometry-match-point`, `geometry-match-linestring`, `geometry-match-polygon`];

        return [];
    }

    remove() {
        // 外部删除 
        this.options.onRemove?.call(undefined, this.feature);

        // 更新地图
        const index = this.parent.items.indexOf(this);
        this.parent.items.splice(index, 1);
        this.parent.updateDataSource();

        // 删除ui
        this.htmlElement.remove();
    }

    setUIVisible(value: boolean) {
        if (value)
            this.htmlElement.classList.remove('jas-ctrl-hidden');
        else
            this.htmlElement.classList.add('jas-ctrl-hidden');
    }

    createSuffixElement(options: {
        editGeometry?: boolean
    } = {}) {
        const element = dom.createHtmlElement('div', ['jas-ctrl-marker-suffix']);
        if (options.editGeometry) element.append(this.createSuffixEditGeometry());
        element.append(
            this.createSuffixEdit(),
            this.createSuffixExport(),
            this.createSuffixDel());

        return element;
    }

    private createSuffixEdit() {
        const update = () => {
            // 更新地图
            this.parent.updateDataSource();
            // 更新ui
            this.reName(this.feature.properties.name);
        }

        const div = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"],
            [new SvgBuilder('edit').resize(17, 17).create('svg')], {
            onClick: () => {
                const offset = this.parent.parent.options.drawAfterOffset;
                const orgCenter = this.map.getCenter();
                const center = centroid(this.feature as any);
                // 临时禁用
                // this.map.easeTo({
                //     center: center.geometry.coordinates as [number, number],
                //     'offset': offset
                // });

                createFeaturePropertiesEditModal(this.feature, {
                    layers: [],
                    mode: 'update',
                    onConfirm: () => {
                        // 外部更新
                        this.options.onUpdate?.call(undefined, this.feature);
                        update();
                        // 临时禁用
                        // this.map.easeTo({ center: orgCenter });
                    },
                    onCancel: () => {
                        // 临时禁用
                        // this.map.easeTo({ center: orgCenter });
                    },
                    onPropChange: () => {
                        update();
                    }
                })
            }
        });

        div.title = lang.editItem;

        return div;
    }

    private createSuffixEditGeometry() {
        const div = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"], [
            new SvgBuilder('remake').resize(17, 17).create('svg')
        ], {
            onClick: () => {

                // 删除当前图形
                const index = this.parent.items.indexOf(this);
                this.parent.items.splice(index, 1);
                this.parent.updateDataSource();

                // 编辑器重置数据
                const geoEditor = this.parent.parent.geoEditor;
                geoEditor.set({ type: 'FeatureCollection', "features": [this.feature] });
                if (this.feature.geometry.type === 'Point')
                    geoEditor.changeMode('simple_select', { featureIds: [this.feature.id!.toString()] })
                else
                    geoEditor.changeMode('direct_select', { featureId: this.feature.id!.toString() });

                const handleSelectChange = (e: any) => {
                    const cFeature = geoEditor.get(this.feature.id!.toString());

                    // 当前选择图形失去选择状态 完成修改
                    if (e.features.length === 0 && cFeature) {
                        // 若发生改变
                        if (!deep.equal(cFeature.geometry, this.feature.geometry)) {
                            this.feature.geometry = cFeature.geometry;
                            this.options.onUpdate?.call(undefined, this.feature);
                        }

                        // 删除编辑数据
                        this.map.off('draw.selectionchange', handleSelectChange);
                        geoEditor.changeMode('draw_point');
                        geoEditor.deleteAll();

                        // 恢复元数据
                        this.parent.items.push(this);
                        this.parent.updateDataSource();
                    }
                }

                this.map.on('draw.selectionchange', handleSelectChange);
            }
        });

        div.title = lang.edit_graph;

        return div;
    }

    private createSuffixExport() {
        const div = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"],
            [new SvgBuilder('export').resize(15, 15).create('svg')], {
            onClick: () => {
                createExportModal(this.feature.properties.name, this.feature);
            }
        });

        div.title = lang.exportItem;

        return div;
    }

    private createSuffixDel() {
        const div = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"],
            [new SvgBuilder('delete').resize(15, 15).create('svg')], {
            onClick: () => {
                createConfirmModal({
                    title: lang.deleteItem,
                    content: this.feature.properties.name,
                    onConfirm: () => {
                        this.remove();
                    }
                });
            }
        });

        div.title = lang.deleteItem;

        return div;
    }
}