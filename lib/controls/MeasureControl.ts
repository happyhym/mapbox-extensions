import mapboxgl from "mapbox-gl";
import { dom } from 'wheater';
import centroid from '@turf/centroid';
import { svg } from '../common';
import {
    MeasureBase, MeasureType,
    MeasurePoint, MeasurePointOptions,
    MeasureProfile, MeasureProfileOptions,
    MeasureLineString, MeasureLineStringOptions,
    MeasurePolygon, MeasurePolygonOptions,
} from "../features/measure";

const { SvgBuilder } = svg;

// oe: 使用 declare 关键字声明要在 Typescript 中调用已在 Javascript 中定义的全局变量或函数
declare let isMeasuring: boolean;
declare let woaLayerOn: any;
declare let woaProfileOn: any;
declare let velocityLayerOn: any;
declare let velocityProfileOn: any;

export interface MeasureControlOptions {

    /**
     * 控件是否横置(default false)
     */
    horizontal?: boolean;

    /**
     * 按钮背景颜色
     */
    btnBgColor?: string;

    /**
     * 按钮激活颜色
     */
    btnActiveColor?: string;

    /**
     * 图形是否可以点击
     */
    geometryClick?: boolean;

    /**
     * 允许的测量模式，默认所有
     */
    enableModes?: MeasureType[];

    /**
     * 删除feature回调
     */
    onFeatureDelete?: (id: string) => void;

    /**
     * 复制完成
     */
    onGeometryCopy?: (geometry: string) => void;

    onStart?: () => void;
    onStop?: () => void;
    onClear?: () => void;

    /** 
     * 测量点选项
     */
    measurePointOptions?: MeasurePointOptions;

    /** 
     * 测量剖面选项
     */
    measureProfileOptions?: MeasureProfileOptions;

    /**
     * 测量线选项
     */
    measureLineStringOptions?: MeasureLineStringOptions;

    /**
     * 测量面选项
     */
    measurePolygonOptions?: MeasurePolygonOptions;
}

export class MeasureControl implements mapboxgl.IControl {

    private measures = new Map<MeasureType, { measure: MeasureBase, svg: string, controlElement?: HTMLElement | undefined }>();
    private currentMeasure: MeasureBase | undefined;
    private popup = new mapboxgl.Popup({ closeButton: false, className: 'jas-mapbox-popup' });
    private declare element: HTMLElement;

    constructor(private options: MeasureControlOptions = {}) {
        options.horizontal ??= false;

        options.horizontal ??= false;
        options.btnBgColor ??= "transparent"; //"#ffffff";
        options.btnActiveColor ??= "#87ceeb";
        options.enableModes ??= ['Point', 'Profile', 'LineString', 'Polygon'];
        options.geometryClick ??= false;
        options.measurePointOptions ??= {};
        options.measureProfileOptions ??= {};
        options.measureLineStringOptions ??= {};
        options.measurePolygonOptions ??= {};
    }

    get isDrawing() {
        return this.currentMeasure !== undefined;
    }

    get layerIds() {
        let ids = new Array<string>();
        this.measures.forEach(m => {
            ids = ids.concat(m.measure.layerGroup.layerIds);
        })
        return ids;
    }

    onAdd(map: mapboxgl.Map): HTMLElement {
        this.measures.set('Point', { measure: new MeasurePoint(map, this.options.measurePointOptions), svg: new SvgBuilder('point').create() });
        this.measures.set('Profile', { measure: new MeasureProfile(map, this.options.measureProfileOptions), svg: new SvgBuilder('profile').create() });
        this.measures.set('LineString', { measure: new MeasureLineString(map, this.options.measureLineStringOptions), svg: new SvgBuilder('line').create() });
        this.measures.set('Polygon', { measure: new MeasurePolygon(map, this.options.measurePolygonOptions), svg: new SvgBuilder('polygon').create() });

        this.measures.forEach((_, k) => {
            if (this.options.enableModes?.indexOf(k) === -1)
                this.measures.delete(k);
        })

        this.element = dom.createHtmlElement('div',
            ["jas-ctrl-measure", "mapboxgl-ctrl", "mapboxgl-ctrl-group", this.options.horizontal ? "hor" : "ver"]);

        this.measures.forEach((value, key) => {
            const btn = this.createButton(value.svg, this.createClickMeasureButtonHandler(map, key));
            // oe: 设置 title
            btn.title = key === "Point" ? "获取鼠标点击处经纬度和高程" : key === "Profile" ? "获取鼠标点击处海洋要素信息" : key === "LineString" ? "测量线段长度" : key === "Polygon" ? "测量面积" : "";
            value.controlElement = btn;
            this.element.append(btn);
        })

        // oe: 设置 title
        const cleanBtn = this.createButton(new SvgBuilder("clean").create(), () => {
            this.measures.forEach(m => m.measure.clear());
            this.options.onClear?.call(undefined);
        });
        cleanBtn.title = "清除测量图层";
        this.element.append(cleanBtn);

        return this.element;
    }

    onRemove(map: mapboxgl.Map): void {
        this.stop();
        this.measures.forEach(m => m.measure.destroy());
        this.element.remove();
    }

    getDefaultPosition?: (() => string) | undefined;

    stop() {
        if (this.currentMeasure) {
            const type = this.currentMeasure.type;

            // 停止测量
            isMeasuring = false;
            if (!woaLayerOn && !woaProfileOn)
                document.getElementById("depthIndexSelector")!.style.display = document.getElementById("depthIndexValue")!.style.display = "none";
            this.currentMeasure.stop();
            // 颜色恢复默认
            this.measures.get(this.currentMeasure.type)!.controlElement!.style.background = this.options.btnBgColor!

            this.currentMeasure = undefined;

            return type;
        }
    }

    private createClickMeasureButtonHandler(map: mapboxgl.Map, measureType: MeasureType) {
        return () => {

            // 停止测量 如果当前测量类型按钮再次点击 则取消测量
            if (this.stop() === measureType) {
                this.changeGeometryEvent(map, true);
                this.options.onStop?.call(this);
                return;
            }

            this.options.onStart?.call(this);
            this.changeGeometryEvent(map, false);

            // 根据类型获取测量模式
            // 将这个测量模式的按钮设置为激活状态样式
            // 设置当前的测量模式
            // 测量开始
            const measureProps = this.measures.get(measureType)!;
            measureProps.controlElement!.style.background = this.options.btnActiveColor!;
            this.currentMeasure = measureProps.measure;
            this.currentMeasure?.start();

            // 响应 esc 键（按下 esc 键停止测量）
            isMeasuring = true;
            document.addEventListener("keydown", this.escapeHandler, true);
        }
    }

    private escapeHandler = (event: KeyboardEvent) => {
        if (event.key == "Escape") {
            // 响应 esc 键（按下 esc 键停止测量）
            document.removeEventListener("keydown", this.escapeHandler, true);
            this.stop();
        }
    }

    private createButton(svg: string, onclick: () => void) {
        const div = dom.createHtmlElement('div', ['jas-btn-hover', 'jas-flex-center', 'jas-ctrl-measure-item']);
        div.innerHTML += svg;
        div.onclick = onclick;
        return div;
    }

    private changeGeometryEvent(map: mapboxgl.Map, on: boolean) {
        if (!this.options.geometryClick)
            return;

        this.measures.forEach(mp => {
            if (on) {
                map.on('mouseover', mp.measure.layerGroup.layerIds, this.geometryMouseoverHandler);
                map.on('mouseout', mp.measure.layerGroup.layerIds, this.geometryMouseoutHandler);
                map.on('click', mp.measure.layerGroup.layerIds, this.geometryClickHandler);
            } else {
                this.popup.remove();
                map.off('mouseover', mp.measure.layerGroup.layerIds, this.geometryMouseoverHandler);
                map.off('mouseout', mp.measure.layerGroup.layerIds, this.geometryMouseoutHandler);
                map.off('click', mp.measure.layerGroup.layerIds, this.geometryClickHandler);
            }
        });
    }

    private geometryMouseoverHandler = (ev: mapboxgl.MapLayerEventType['mouseover'] & mapboxgl.EventData) => {
        ev.target.getCanvas().style.cursor = "pointer";
    };

    private geometryMouseoutHandler = (ev: mapboxgl.MapLayerEventType['mouseout'] & mapboxgl.EventData) => {
        ev.target.getCanvas().style.cursor = "";
    }

    private geometryClickHandler = (ev: mapboxgl.MapLayerEventType['click'] & mapboxgl.EventData) => {
        const feature = ev.features?.at(0);
        if (!feature) return;

        try {
            this.measures.forEach(mp => {
                const pf = mp.measure.getFeatrue(feature.properties!['id'].toString());
                if (pf) {
                    const center = centroid(pf.geometry as any).geometry.coordinates;
                    this.popup.setHTML(`<div style="display:flex;align-items:center;">
                                                <div id="popup-btn-copy" class='jas-ctrl' style="margin:0 5px 0 0;cursor:pointer;">${new SvgBuilder('copy').create()}</div>
                                                <div id="popup-btn-clean" class='jas-ctrl' style="cursor:pointer;">${new SvgBuilder('clean').create()}</div>
                                            </div>`).setLngLat(ev.lngLat).addTo(ev.target);

                    const copyBtn = document.getElementById("popup-btn-copy")!;
                    const cleanBtn = document.getElementById("popup-btn-clean")!;

                    copyBtn.addEventListener('click', e => {
                        const geometry = JSON.stringify(pf.geometry);
                        this.options.onGeometryCopy?.call(this, geometry);
                        dom.copyToClipboard(geometry);
                    });

                    cleanBtn.addEventListener('click', e => {
                        const id = pf.id!.toString();
                        mp.measure.deleteFeature(id);
                        this.popup.remove();
                        this.options.onFeatureDelete?.call(this, id);
                    });

                    ev.target.flyTo({ center: [center[0], center[1]] });
                    throw new Error("break");
                }
            });
        } catch (error) {

        }
    }
}