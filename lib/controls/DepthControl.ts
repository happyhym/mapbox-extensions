import mapboxgl from "mapbox-gl";
import { dom } from 'wheater';

// oe: 使用 declare 关键字声明要在 Typescript 中调用已在 Javascript 中定义的全局变量或函数
declare let layerIndex: any;

export interface DepthControlOptions {
    /**
     * 控件默认位置
     */
    defaultPosition?: string;
    /**
     * 经纬度保留的小数位数
     */
    fractionDigits?: number;
    /**
     * 经度显示文本前缀
     */
    lngPrefix?: string;
    /**
     * 纬度显示文本前缀
     */
    latPrefix?: string;
}

/**
 * 位置控件：实时显示鼠标所在位置的经纬度
 */
export class DepthControl implements mapboxgl.IControl {

    readonly element = dom.createHtmlElement('div', ["mapboxgl-ctrl"]);
    // readonly range=dom.createHtmlElement('input');;
    
    constructor(private options: DepthControlOptions = {}) {
        this.options.defaultPosition ??= "top-left";

        let range = dom.createHtmlElement('input');
        range.type = 'range';
        range.min = '0';
        range.max = '101';
        range.value = '10';
        range.step = '1';
        range.addEventListener('input', function () {
            layerIndex = this.value;
        });
        // range.style.padding = '6px 18px 6px 6px';
        // range.style.outline = 'none';
        // range.style.border = '1px solid #ddd';
        // range.style.borderRadius = '4px';
        this.element.append(range);
    }

    onAdd(map: mapboxgl.Map): HTMLElement {
        let that = this;
        // map.on("mousemove", function (e) {
        //     let lng = e.lngLat.lng;
        //     let lat = e.lngLat.lat;
        //     that.element.innerHTML = `${that.options.lngPrefix} ${Math.abs(lng).toFixed(that.options.fractionDigits)}° ${lng > 0 ? "E" : "W"}&nbsp;&nbsp;${that.options.latPrefix} ${Math.abs(lat).toFixed(that.options.fractionDigits)}° ${lat > 0 ? "N" : "S"}`;
        // });
        return that.element;
    }

    onRemove(map: mapboxgl.Map): void {
        this.element.remove();
    }

    getDefaultPosition(): string { return this.options.defaultPosition! };

}