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
declare const undo: any;
declare const redo: any;
declare const saveLayer: any;
declare const readonlyLayers: any;
declare const trackReplay: any;
declare const switchWoaLayer: any;
declare const switchOceanicCrustalAgeLayer: any;
declare let uneyed: any;
declare let shp: any;
declare let userName: string;
declare let markerItemsExpanded: string[];
declare let markerItemsViewSingle: string[];
declare let markerItemsNoHidden: string[];

// oe: 要从数据库中删除的图层
let layersToDeleted: any = [];
// oe: 图层（要素）删除/重做列表
let undoList: any = [];
export { SvgBuilder, layersToDeleted, undoList };

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
    // 是否显示顶部工具栏，默认不显示顶部工具栏
    enableHeader?: boolean,
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
        // options.enableHeader ??= true;

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

        if (options.enableHeader == false) {
            this.htmlElement.append(this.layerContainer);
            return;
        }
        // enableHeader 为 false 时，不加载 Header
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
        btnPoint.title = "添加点"; // lang.point;
        btnLine.title = "单击添加线，双击结束"; // lang.line;
        btnPolygon.title = "单击添加多边形，双击结束"; // lang.polygon;
        btnRectangle.title = "添加矩形"; // lang.rectangle;
        btnCircle.title = "添加圆形"; // lang.circle;

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
        const btnUndo = dom.createHtmlElement('button', ["jas-ctrl-marker-item-btn"]);
        const btnRedo = dom.createHtmlElement('button', ["jas-ctrl-marker-item-btn"]);
        const btnSaveLayer = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);
        const btnRestoreLayer = dom.createHtmlElement('div', ["jas-ctrl-marker-item-btn"]);

        // 设置 title
        btnAddLayer.title = lang.newLayer;
        btnUndo.title = lang.undo;
        btnUndo.id = "btnUndo";
        //btnUndo.disabled=true;
        btnRedo.title = lang.redo;
        btnRedo.id = "btnRedo";
        //btnRedo.disabled=true;
        btnSaveLayer.title = lang.saveLayer;
        btnRestoreLayer.title = lang.restoreLayer;

        // 设置 图标
        btnAddLayer.innerHTML = new SvgBuilder('add').resize(25, 25).create();
        btnUndo.innerHTML = `<img src="_content/IDSSE.OceanExplorer.Shared/images/svg/undo.svg" style="width:18px;height:18px;" />`;
        btnRedo.innerHTML = `<img src="_content/IDSSE.OceanExplorer.Shared/images/svg/redo.svg" style="width:18px;height:18px;" />`;
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
        // oe: 撤销
        btnUndo.addEventListener('click', async () => await undo());
        // oe: 重做
        btnRedo.addEventListener('click', async () => await redo());
        // 将图层（图层属性及其上的所有 features）存入数据库
        btnSaveLayer.addEventListener('click', async () => await saveLayer());
        // 从数据库加载图层
        btnRestoreLayer.addEventListener('click', () => dotNetHelper.invokeMethodAsync("FetchLayers"));

        const c = dom.createHtmlElement('div', ["jas-flex-center", "jas-ctrl-marker-btns-container"]);
        c.append(btnAddLayer, btnUndo, btnRedo, btnSaveLayer);
        return c;
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

    // oe: 保存旧名称，用于恢复/重做图层名称更新
    public oldName: string = "";

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

        // 图层默认显示
        this.properties.show ??= true;

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
                    visibility: this.properties.show ? "visible" : "none",
                    "text-field": ['get', 'name'],
                    'text-size': ['get', 'textSize', ['get', 'style']],
                    'icon-image': ['get', 'pointIcon', ['get', 'style']],
                    'icon-size': ['get', 'pointIconSize', ['get', 'style']],
                    'text-justify': 'auto',
                    "icon-allow-overlap": true,
                    "text-allow-overlap": true,
                    "icon-ignore-placement": true,
                    "text-ignore-placement": true,
                    "text-optional": false,
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
                    visibility: this.properties.show ? "visible" : "none",
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
                    visibility: this.properties.show ? "visible" : "none",
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
                layout: {
                    visibility: this.properties.show ? "visible" : "none",
                },
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
                    visibility: this.properties.show ? "visible" : "none",
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

            // oe: 在底图上单击船舶时，不显示回放按钮，避免跟船舶位置信息显示重叠
            if (item.feature.properties.id.endsWith("-ship-menu-tree"))
                return;

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

        // 设置图层组标题
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
        // oe: 删除图层
        layersToDeleted.push({ id: this.properties.id, name: this.properties.name });
        // oe: 临时保存删除的图层，用于恢复操作
        var features = this.items.map(x => x.feature);
        undoList.push({ action: "remove", target: "markerLayer", properties: this.properties, features: features });
        console.log(`点保存按钮，将从数据库中删除图层：${this.properties.id}:${this.properties.name}`);
        var btnUndo = document.getElementById("btnUndo") as HTMLButtonElement;
        if (btnUndo) {
            btnUndo.disabled = false;
        }

        this.options.onRemove?.call(undefined, this.properties);
        const index = this.parent.markerLayers.indexOf(this);
        this.parent.markerLayers.splice(index, 1);
        this.htmlElement.remove();
        this.map.removeLayerGroup(this.layerGroup.id);
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
        // let nameLayer = this.map.getLayer(this.properties.name);
        // 基础图层（专属经济区、海山、海岸线、船舶位置、船舶轨迹）禁用编辑/导入/导出/删除按钮
        // if (!nameLayer && this.properties.name != "Undersea Feature Gazetteer" && this.properties.name != "船舶位置") {
        if (!readonlyLayers.includes(this.properties.name)) {
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

        if (this.properties.name.includes("探索") || this.properties.name.endsWith("船") || this.properties.name.endsWith("Fleet"))
            header.append(content, suffix, this.createShipLocationVisible(), this.createShipTrackVisible());
        else if (userName == "idsse" && (this.properties.name.endsWith("深海勇士") || this.properties.name.endsWith("奋斗者")))
            // else if ((this.properties.name.endsWith("深海勇士") || this.properties.name.endsWith("奋斗者")))
            header.append(content, suffix, this.createSuffixUpload(), this.createSuffixVisible());
        else
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
                accept: ".zip,.json,.geojson,.kml,.kmz"
            }
        });

        importUI.onchange = async e => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                if (file.name.endsWith('zip')) {
                    // const url = URL.createObjectURL(file);
                    // const a = document.createElement('a');
                    // a.href = url;
                    // a.download = file.name;
                    // document.body.appendChild(a);
                    // a.click();
                    // a.remove();

                    // 获取上传文件的字节流
                    let buffer = await file.arrayBuffer();

                    // // 解压，解决中文乱码（已通过修改编译 shapefile-js 源码支持中文）
                    // var zip = await JSZip.loadAsync(buffer)
                    // // 没有文件需要添加
                    // if (!Object.keys(zip['files']).some(item => item.includes('.cpg'))) {
                    //     var fileName = Object.keys(zip['files']).find(element => element.includes('.'))
                    //     fileName = fileName.substring(0, fileName.indexOf('.')) + '.cpg'
                    //     zip.file(fileName, "gb2312");
                    //     //压缩
                    //     buffer = await zip.generateAsync({ type: 'arraybuffer' })
                    // }

                    // 解析为 geojson 对象
                    let result = await shp.parseZip(buffer, ["white", "list"]);

                    // 判断解析结果是否为数组
                    // const isArrary = Array.isArray(result);
                    const isArrary = result instanceof Array;
                    let geojson = [];
                    if (isArrary)
                        geojson.push(...result);
                    else
                        geojson.push(result);
                    geojson.forEach(async (item: any) => {
                        const fc = await new Importer('shp').import(this.properties.id, item);
                        if (fc.features.length > 0) {
                            fc.features.forEach(f => this.addMarker(f));
                            const b = bbox(fc);
                            this.map.fitBounds([b[0], b[1], b[2], b[3]], { padding: 100 });
                            this.collapse(false);
                        }
                    });
                } else if (file.name.endsWith('json') || file.name.endsWith('geojson')) {
                    const t = await file.text();
                    const result = JSON.parse(t);
                    // 判断解析结果是否为数组
                    // const isArrary = Array.isArray(result);
                    const isArrary = result instanceof Array;
                    let geojson = [];
                    if (isArrary)
                        geojson.push(...result);
                    else
                        geojson.push(result);
                    geojson.forEach(async (item: any) => {
                        const fc = await new Importer('geojson').import(this.properties.id, item);
                        if (fc.features.length > 0) {
                            fc.features.forEach(f => this.addMarker(f));

                            const b = bbox(fc);
                            this.map.fitBounds([b[0], b[1], b[2], b[3]], { padding: 100 });
                            this.collapse(false);
                        }
                    });
                } else if (file.name.endsWith('kml') || file.name.endsWith('kmz')) {
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
            // oe: 记录更新前的图层名字
            this.oldName = this.properties.name;

            createMarkerLayerEditModel(this.properties, {
                mode: 'update',
                onConfirm: () => {
                    // oe: 恢复图层名称
                    undoList.push({ action: "edit", target: "markerLayer", properties: this.properties });
                    var btnUndo = document.getElementById("btnUndo") as HTMLButtonElement;
                    if (btnUndo) {
                        btnUndo.disabled = false;
                    }

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
        const visible = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);
        this.setGeometryVisible = (value: boolean) => {
            // oe: 对于基础图层（海岸线、专属经济区）已通过设置 show 属性来控制图层的显隐
            // visible.innerHTML = value ? eye : uneye;
            // this.layerGroup.show = value;
        }
        if (markerItemsExpanded.includes(this.properties.name)) {
            // 默认展开世界海洋数据图集、地球板块和洋壳数据
            this.arrow.classList.toggle("jas-collapse-active");
            this.itemContainerElement.classList.toggle("jas-ctrl-hidden");
        }
        // dstic 用户登录时展开海南省深海技术创新中心展
        if (["海南省深海技术创新中心展"].includes(this.properties.name) && userName == "dstic") {
            this.arrow.classList.toggle("jas-collapse-active");
            this.itemContainerElement.classList.toggle("jas-ctrl-hidden");
        }

        // 世界海洋数据图集，不能同时显示多个海洋要素图层，因此不需要显示/隐藏按钮，直接返回
        if (markerItemsViewSingle.includes(this.properties.name))
            return visible;

        const svgBuilder = new SvgBuilder('eye').resize(18, 18);
        const eye = svgBuilder.create();
        const uneye = svgBuilder.change('uneye').create();

        // oe: 对于基础图层（海岸线、专属经济区）通过设置 show 属性来控制图层的显隐
        visible.innerHTML = this.properties.show ? eye : uneye;

        visible.addEventListener('click', () => {
            const isEye = visible.innerHTML === eye;
            visible.innerHTML = isEye ? uneye : eye;
            this.layerGroup.show = !isEye;
            // 更新图层显示状态用于持久化存储
            this.properties.show = this.layerGroup.show;
            // oe: 用于控制以 this.properties.name 为 id 的图层，即基础图层（海岸线、专属经济区），这样该图层可不设置 markerOptions.featureCollection.features，显隐功能直接应用于图层
            if (readonlyLayers.includes(this.properties.name) && this.map.getLayer(this.properties.name))
                this.map.setLayoutProperty(this.properties.name, "visibility", this.layerGroup.show ? "visible" : "none");

            // oe: 用于控制以 this.properties.name 为 id 的图层组（Undersea Feature Gazetteer、文物保护区等）
            let layers = this.map.getLayerGroup(this.properties.name);
            if (layers) {
                layers?.layerIds!.forEach(id => {
                    // alert(id);
                    this.map.setLayoutProperty(id, "visibility", this.layerGroup.show ? "visible" : "none");
                }
                );
            }
            // 通过船舶位置图层控制 shipLocation 图层的显示/隐藏
            // if (this.properties.id == "shipLocation") {
            //     let shipLocationLayers = this.map.getLayerGroup("船舶位置");
            //     shipLocationLayers?.layerIds!.forEach(id => this.map.setLayoutProperty(id, "visibility", this.layerGroup.show ? "visible" : "none"));
            // }
            // 控制 Undersea Feature Gazetteer 图层的显示/隐藏
            // if (this.properties.id == "Undersea Feature Gazetteer") {
            //     let underseaLayers = this.map.getLayerGroup("Undersea-Feature-Gazetteer");
            //     underseaLayers?.layerIds!.forEach(id => this.map.setLayoutProperty(id, "visibility", this.layerGroup.show ? "visible" : "none"));
            // }
        });

        visible.style.cursor = "pointer";
        visible.style.marginLeft = "5px";
        visible.title = lang.visibility;
        return visible;
    }

    private createShipLocationVisible() {
        if (markerItemsExpanded.includes(this.properties.name)) {
            // 默认展开探索系列和海监船舶
            this.arrow.classList.toggle("jas-collapse-active");
            this.itemContainerElement.classList.toggle("jas-ctrl-hidden");
        }

        const svgBuilder = new SvgBuilder('eye').resize(18, 18);
        const eye = svgBuilder.create();
        const uneye = svgBuilder.change('uneye').create();

        const visible = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);

        // oe: 对于基础图层（海岸线、专属经济区）通过设置 show 属性来控制图层的显隐
        visible.innerHTML = this.properties.show ? eye : uneye;

        visible.addEventListener('click', () => {
            const isEye = visible.innerHTML === eye;
            visible.innerHTML = isEye ? uneye : eye;
            this.layerGroup.show = !isEye;

            // 遍历每条船，将其显示/隐藏按钮置为当前状态（有 bug，功能还未完全实现）
            // this.items.forEach(item => {
            //     item.suffix.innerHTML = `<div class="jas-ctrl-marker-suffix-item" title="轨迹回放" style="cursor: pointer; margin-left: 5px;"><img
            // src="_content/IDSSE.OceanExplorer.Shared/images/svg/play.svg" style="width:18px;height:18px;"></div>${visible.innerHTML}${visible.innerHTML}`;
            // });

            // oe: 用于控制以 this.properties.name 为 id 的图层组（Undersea Feature Gazetteer、文物保护区等）
            // let layers = this.map.getLayerGroup(this.properties.name);
            // if (layers)
            //     layers?.layerIds!.forEach(id => {
            //         if (id.endsWith("-track-layer"))
            //             return;
            //         this.map.setLayoutProperty(id, "visibility", this.layerGroup.show ? "visible" : "none");
            //     });

            // 点击了船舶分组显/隐图标，则遍历每条船，根据该船船位图层状态，调用 .NET 接口初始化
            this.items.forEach(async (item) => {
                let feature = item.feature as MarkerFeatureType;
                let shipLocationLayerGroup = this.map.getLayerGroup(feature.properties.layerId);
                if (!shipLocationLayerGroup) {
                    shipLocationLayerGroup = this.map.addLayerGroup(feature.properties.layerId);
                }
                let locationLayer = `${feature.properties.name}-location-layer`;
                let statusLayer = `${feature.properties.name}-status-layer`;
                if (shipLocationLayerGroup.layerIds.indexOf(locationLayer) < 0 || shipLocationLayerGroup.layerIds.indexOf(statusLayer) < 0) {
                    await new Promise(async (resolve) => {
                        // console.log(`init ship location layer for ${feature.properties.description} ...`);
                        await dotNetHelper.invokeMethodAsync("FetchShipLocation", feature.properties.description, -180, 180, -90, 90, undefined);
                        // 加载后显示船位，同时将船位显/隐按钮同步设置为打开
                        item.locationVisible.innerHTML = item.eye;//this.layerGroup.show ? item.eye : item.uneye;
                    }).then(() => {
                        this.map.setLayoutProperty(`${feature.properties.name}-location-layer`, "visibility", this.layerGroup.show ? "visible" : "none");
                        this.map.setLayoutProperty(`${feature.properties.name}-status-layer`, "visibility", this.layerGroup.show ? "visible" : "none");
                    });
                }
                else {
                    // 同步船位显/隐按钮状态
                    item.locationVisible.innerHTML = this.layerGroup.show ? item.eye : item.uneye;
                    this.map.setLayoutProperty(`${feature.properties.name}-location-layer`, "visibility", this.layerGroup.show ? "visible" : "none");
                    this.map.setLayoutProperty(`${feature.properties.name}-status-layer`, "visibility", this.layerGroup.show ? "visible" : "none");
                }

                // let feature = item.feature as MarkerFeatureType;
                // const center = centroid(item.feature as any);
                // const centerPoint = center.geometry.coordinates as [number, number];
                // // 如果经纬度是 [98,4]，说明是未初始化船舶位置和轨迹的要素
                // if (centerPoint[0] == 98 && centerPoint[1] == 4) {
                //     let s = feature.properties.id.split("-")
                //     if (s.length < 2)
                //         return;
                //     let mmsi = s[0];
                //     console.log(`update MarkerControl item for ${mmsi} ...`);
                //     // 判断是否为船舶要素，是则通过调用 .NET 接口获取数据并显示
                //     if (mmsi == feature.properties.description) {
                //         await new Promise(async (resolve) => {
                //             // 加载非探索系列船舶的船位和轨迹
                //             await dotNetHelper.invokeMethodAsync("FetchShipLocation", mmsi, -180, 180, -90, 90, undefined);
                //             // 加载后显示船位，同时将船位显/隐按钮同步设置为打开
                //             item.visible?.click();
                //         });
                //     }
                // }
            });
        });

        this.setGeometryVisible = (value: boolean) => {
            // oe: 对于基础图层（海岸线、专属经济区）已通过设置 show 属性来控制图层的显隐
            // visible.innerHTML = value ? eye : uneye;
            // this.layerGroup.show = value;
        }

        visible.style.cursor = "pointer";
        visible.style.marginLeft = "5px";
        visible.title = `${lang.visibility}船位`;
        return visible;
    }

    private createShipTrackVisible() {
        const svgBuilder = new SvgBuilder('eye').resize(18, 18);
        const eye = svgBuilder.create();
        const uneye = svgBuilder.change('uneye').create();

        const visible = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);

        // oe: 对于基础图层（海岸线、专属经济区）通过设置 show 属性来控制图层的显隐
        visible.innerHTML = this.properties.show ? eye : uneye;

        visible.addEventListener('click', () => {
            const isEye = visible.innerHTML === eye;
            visible.innerHTML = isEye ? uneye : eye;
            this.layerGroup.show = !isEye;

            // oe: 用于控制以 this.properties.name 为 id 的图层组（Undersea Feature Gazetteer、文物保护区等）
            // let layers = this.map.getLayerGroup(this.properties.name);
            // if (layers)
            //     layers?.layerIds!.forEach(id => {
            //         if (id.endsWith("-track-layer"))
            //             this.map.setLayoutProperty(id, "visibility", this.layerGroup.show ? "visible" : "none");
            //     });

            // 点击了船舶分组显/隐图标，则遍历每条船，根据该船轨迹图层状态，调用 .NET 接口初始化
            this.items.forEach(async (item) => {
                let feature = item.feature as MarkerFeatureType;
                let shipTrackLayerGroup = this.map.getLayerGroup(feature.properties.layerId);
                if (!shipTrackLayerGroup)
                    shipTrackLayerGroup = this.map.addLayerGroup(feature.properties.layerId);
                let trackLayer = `${feature.properties.name}-track-layer`;
                if (shipTrackLayerGroup.layerIds.indexOf(trackLayer) < 0) {
                    await new Promise(async (resolve) => {
                        await dotNetHelper.invokeMethodAsync("FetchShipTrack", feature.properties.description, -180, 180, -90, 90, 15, 1000, 10, undefined);
                        // 加载后显示轨迹，同时将轨迹显/隐按钮同步设置为打开
                        item.trackVisible.innerHTML = item.eye;//this.layerGroup.show ? item.eye : item.uneye;
                    }).then(() => {
                        this.map.setLayoutProperty(`${feature.properties.name}-track-layer`, "visibility", this.layerGroup.show ? "visible" : "none");
                        // item.visible?.click();
                    });
                }
                else {
                    // 同步轨迹显/隐按钮状态
                    item.trackVisible.innerHTML = this.layerGroup.show ? item.eye : item.uneye;
                    this.map.setLayoutProperty(`${feature.properties.name}-track-layer`, "visibility", this.layerGroup.show ? "visible" : "none");
                }
            });
        });

        this.setGeometryVisible = (value: boolean) => {
            // oe: 对于基础图层（海岸线、专属经济区）已通过设置 show 属性来控制图层的显隐
            // visible.innerHTML = value ? eye : uneye;
            // this.layerGroup.show = value;
        }

        visible.style.cursor = "pointer";
        visible.style.marginLeft = "5px";
        visible.title = `${lang.visibility}轨迹`;
        return visible;
    }

    private createSuffixUpload() {
        const uploadUI = dom.createHtmlElement('input', [], [], {
            attributes: {
                type: "file",
                accept: ".xls,.xlsx",
                "multiple": "multiple"
            }
        });

        uploadUI.onchange = async e => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files?.length > 0) {
                const formData = new FormData();
                formData.append("user", userName);
                for (let i = 0; i < files.length; i++) {
                    formData.append("files[]", files[i]);
                }
                // formData.append("file", files[0]);
                // await fetch("http://127.0.0.1:8123/api/Import/PostFile", {
                await fetch("api/Upload/UploadHov", {
                    // 在使用 form-data 提交时不应手动设置 content-type
                    // headers: {
                    //     'Content-Type': 'multipart/form-data'
                    // },
                    method: 'POST',
                    body: formData
                }).then(async response => await response.text())
                    .then(msg => alert(msg));
            }

            // 处理input file不能重复上传
            uploadUI.type = "text";
            uploadUI.type = "file";
        }

        const upload = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"], [
            new SvgBuilder('upload').resize(15, 15).create('svg')
        ], {
            attributes: {
                title: lang.upload
            },
            onClick: () => {
                uploadUI.click();
            }
        });

        return upload;
    }
}

class MarkerItem extends AbstractLinkP<MarkerLayer> {
    public suffix: any;
    readonly htmlElement = dom.createHtmlElement('div', ['jas-ctrl-marker-item-container']);
    public readonly reName: (name: string) => void;
    public visible: any = undefined;
    public locationVisible: any = undefined;
    public trackVisible: any = undefined;
    public svgBuilder = new SvgBuilder('eye').resize(18, 18);
    public eye = this.svgBuilder.create();
    public uneye = this.svgBuilder.change('uneye').create();

    // oe: 记录更新前的要素
    public clonedFeature: string = "";

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
        this.suffix = this.createSuffixElement();
        // oe: 对于世界海洋数据图集图层和每条船舶，一直显示显隐按钮
        // ["全球海洋","平均流场分布"].find(item => feature.properties.name.includes(item))
        // if (!["全球海洋", "平均流场分布", "地球洋壳年龄"].find(item => feature.properties.name.includes(item)) && !feature.properties.id.endsWith("-ship-menu-tree"))
        if (!markerItemsNoHidden.includes(this.parent.properties.name))
            this.suffix.classList.add('jas-ctrl-hidden');
        const content = dom.createHtmlElement('div', ['jas-ctrl-marker-item-container-content']);
        content.innerText = feature.properties.name;

        this.reName = (name: string) => content.innerText = name;

        content.addEventListener('click', async () => {
            // 点击聚焦
            if (!this.feature.properties.id.includes("-readonly")) {
                const offset = this.parent.parent.options.drawAfterOffset;
                const center = centroid(this.feature as any);
                const centerPoint = center.geometry.coordinates as [number, number];
                // 如果经纬度是 [98,4]，说明是未初始化船舶位置和轨迹的要素
                if (centerPoint[0] == 98 && centerPoint[1] == 4) {
                    let s = feature.properties.id.split("-")
                    if (s.length < 2)
                        return;
                    let mmsi = s[0];
                    console.log(`update MarkerControl item for ${mmsi} ...`);
                    // 判断是否为船舶要素，是则通过调用 .NET 接口获取数据并显示
                    if (mmsi == feature.properties.description) {
                        await new Promise(async (resolve) => {
                            // 加载非探索系列船舶的船位和轨迹
                            await dotNetHelper.invokeMethodAsync("FetchShipLocation", mmsi, -180, 180, -90, 90, undefined);
                            // 加载后显示船位，同时将船位显/隐按钮同步设置为打开
                            this.visible?.click();
                        }).then(() => {
                            this.map.easeTo({
                                center: centerPoint,
                                'offset': offset
                            });
                        });
                    }
                }
                else {
                    this.map.easeTo({
                        center: centerPoint,
                        'offset': offset
                    });
                }
            }
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

        // oe: 对于世界海洋数据图集图层和每条船舶，一直显示显隐按钮
        // if (!["全球海洋", "平均流场分布","地球洋壳年龄"].find(item => feature.properties.name.includes(item)) && !feature.properties.id.endsWith("-ship-menu-tree")) {
        if (!markerItemsNoHidden.includes(this.parent.properties.name)) {
            this.htmlElement.addEventListener('mouseenter', () => {
                this.suffix.classList.remove('jas-ctrl-hidden');
            });
            this.htmlElement.addEventListener('mouseleave', () => {
                this.suffix.classList.add('jas-ctrl-hidden');
            });
        }

        this.htmlElement.append(prefix, content, this.suffix);
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
        // oe: 临时保存删除的要素，用于恢复操作
        undoList.push({ action: "remove", target: "markerItem", markerItem: this });
        console.log(`点保存按钮，将从数据库中删除要素：${this.feature.properties.id}:${this.feature.properties.name}`);
        var btnUndo = document.getElementById("btnUndo") as HTMLButtonElement;
        if (btnUndo) {
            btnUndo.disabled = false;
        }

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

        // oe: 船舶航行动态数据分析（船舶列表），每条船都有显示/隐藏按钮
        if (this.feature.properties.id.endsWith("-ship-menu-tree")) {
            this.visible = this.createShipLocationVisible();
            element.append(
                this.createSuffixReplay(),
                this.visible,
                this.createShipTrackVisible()
            );
            return element;
        }

        if (options.editGeometry) element.append(this.createSuffixEditGeometry());

        if (this.feature.properties.id.endsWith("-readonly")) {
            element.append(
                this.createSuffixVisible()
            );
        }
        else
            element.append(
                this.createSuffixEdit(),
                this.createSuffixExport(),
                this.createSuffixDel(),
            );

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

                // oe: 记录更新前的要素
                this.clonedFeature = JSON.stringify(this.feature);

                createFeaturePropertiesEditModal(this.feature, {
                    layers: [],
                    mode: 'update',
                    onConfirm: () => {
                        // oe: 恢复要素名称
                        undoList.push({ action: "edit", target: "markerItem", markItem: this });
                        var btnUndo = document.getElementById("btnUndo") as HTMLButtonElement;
                        if (btnUndo) {
                            btnUndo.disabled = false;
                        }

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

    private createSuffixVisible() {
        const svgBuilder = new SvgBuilder('eye').resize(18, 18);
        const eye = svgBuilder.create();
        const uneye = svgBuilder.change('uneye').create();

        const visible = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);

        this.feature.properties.style.visibility ??= "visible";
        visible.innerHTML = this.feature.properties.style.visibility == "visible" ? eye : uneye;
        visible.id = this.feature.properties.name;
        uneyed = uneye;

        visible.addEventListener('click', async () => {
            const isEye = visible.innerHTML === eye;
            visible.innerHTML = isEye ? uneye : eye;

            if (this.feature.properties.id.includes("-group")) {
                let layers = this.map.getLayerGroup(this.feature.properties.layerId);
                if (layers)
                    layers?.layerIds!.forEach(id => {
                        if (id.startsWith(`${this.feature.properties.name}-group`))
                            this.map.setLayoutProperty(id, "visibility", isEye ? "none" : "visible")
                    });

            }
            else {
                // oe: 更新 woa 图层的显隐（互斥）
                if (this.feature.properties.name.includes("全球海洋"))
                    await switchWoaLayer(this.feature.properties.name, isEye);
                // oe: 地球洋壳年龄图层的显隐
                else if (this.feature.properties.name.includes("地球洋壳年龄"))
                    await switchOceanicCrustalAgeLayer(this.feature.properties.name, isEye);
                this.map.setLayoutProperty(`${this.feature.properties.name}`, "visibility", isEye ? "none" : "visible");
            }
        });

        visible.style.cursor = "pointer";
        visible.style.marginLeft = "5px";
        visible.title = lang.visibility;
        return visible;
    }

    private createShipLocationVisible() {
        this.locationVisible = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);

        this.locationVisible.innerHTML = this.feature.properties.show ? this.eye : this.uneye;
        this.locationVisible.addEventListener('click', async () => {
            const isEye = this.locationVisible.innerHTML === this.eye;
            this.locationVisible.innerHTML = isEye ? this.uneye : this.eye;
            this.feature.properties.show = !isEye;

            // 单击船位显示/隐藏按钮时，根据船位和船舶图层状态，调用 .NET 接口初始化
            let shipLocationLayerGroup = this.map.getLayerGroup(this.feature.properties.layerId);
            if (!shipLocationLayerGroup) {
                shipLocationLayerGroup = this.map.addLayerGroup(this.feature.properties.layerId);
            }
            let locationLayer = `${this.feature.properties.name}-location-layer`;
            let statusLayer = `${this.feature.properties.name}-status-layer`;
            if (shipLocationLayerGroup.layerIds.indexOf(locationLayer) < 0 || shipLocationLayerGroup.layerIds.indexOf(statusLayer) < 0) {
                await new Promise(async (resolve) => {
                    // console.log(`init ship location layer for ${this.feature.properties.description} ...`);
                    await dotNetHelper.invokeMethodAsync("FetchShipLocation", this.feature.properties.description, -180, 180, -90, 90, undefined);
                }).then(() => {
                    this.map.setLayoutProperty(`${this.feature.properties.name}-location-layer`, "visibility", this.feature.properties.show ? "visible" : "none");
                    this.map.setLayoutProperty(`${this.feature.properties.name}-status-layer`, "visibility", this.feature.properties.show ? "visible" : "none");
                });
            }
            else {
                this.map.setLayoutProperty(`${this.feature.properties.name}-location-layer`, "visibility", this.feature.properties.show ? "visible" : "none");
                this.map.setLayoutProperty(`${this.feature.properties.name}-status-layer`, "visibility", this.feature.properties.show ? "visible" : "none");
            }
        });

        this.locationVisible.style.cursor = "pointer";
        this.locationVisible.style.marginLeft = "5px";
        this.locationVisible.title = `${lang.visibility}船位`;
        return this.locationVisible;
    }

    private createShipTrackVisible() {
        this.trackVisible = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);
        this.trackVisible.innerHTML = this.feature.properties.show ? this.eye : this.uneye;
        this.trackVisible.addEventListener('click', async () => {
            const isEye = this.trackVisible.innerHTML === this.eye;
            this.trackVisible.innerHTML = isEye ? this.uneye : this.eye;
            this.feature.properties.show = !isEye;

            // 单击轨迹显示/隐藏按钮时，根据轨迹图层状态，调用 .NET 接口初始化
            let shipTrackLayerGroup = this.map.getLayerGroup(this.feature.properties.layerId);
            if (!shipTrackLayerGroup)
                shipTrackLayerGroup = this.map.addLayerGroup(this.feature.properties.layerId);
            let trackLayer = `${this.feature.properties.name}-track-layer`;
            if (shipTrackLayerGroup.layerIds.indexOf(trackLayer) < 0) {
                await new Promise(async (resolve) => {
                    // console.log(`init ship track layer for ${this.feature.properties.description} ...`);
                    await dotNetHelper.invokeMethodAsync("FetchShipTrack", this.feature.properties.description, -180, 180, -90, 90, 15, 1000, 10, undefined);
                }).then(() => {
                    this.map.setLayoutProperty(`${this.feature.properties.name}-track-layer`, "visibility", this.feature.properties.show ? "visible" : "none");
                });
            }
            else
                this.map.setLayoutProperty(`${this.feature.properties.name}-track-layer`, "visibility", this.feature.properties.show ? "visible" : "none");
        });

        this.trackVisible.style.cursor = "pointer";
        this.trackVisible.style.marginLeft = "5px";
        this.trackVisible.title = `${lang.visibility}轨迹`;
        return this.trackVisible;
    }

    private createSuffixReplay() {
        const svgBuilder = new SvgBuilder('play').resize(18, 18);
        const play = svgBuilder.create();
        const stop = svgBuilder.change('stop').create();

        const btnPlay = dom.createHtmlElement('div', ["jas-ctrl-marker-suffix-item"]);

        // oe: 对于基础图层（海岸线、专属经济区）通过设置 show 属性来控制图层的显隐
        btnPlay.innerHTML = play;

        btnPlay.addEventListener('click', () => {
            const isPlay = btnPlay.innerHTML == play;
            btnPlay.innerHTML = isPlay ? stop : play;
            // 回放逻辑
            trackReplay(`${this.feature.properties.name}`, `${this.feature.properties.id}`);
        });

        btnPlay.style.cursor = "pointer";
        btnPlay.style.marginLeft = "5px";
        btnPlay.title = lang.playStatus;
        return btnPlay;
    }
}