import mapboxgl from "mapbox-gl";
import { dom } from 'wheater';

export interface HtmlControlOptions {
    /**
     * 控件默认位置
     */
    defaultPosition?: string;

    /**
     * 要显示的 HTML 内容
     */
    htmlContent?: string;
}

/**
 * 位置控件：实时显示鼠标所在位置的经纬度
 */
export class LocationControl implements mapboxgl.IControl {

    readonly element = dom.createHtmlElement('div', ["jas-ctrl-location", "mapboxgl-ctrl"]);

    constructor(private options: HtmlControlOptions = {}) {
        this.options.defaultPosition ??= "top-left";
        this.options.htmlContent ??= "Hello World";
    }

    onAdd(map: mapboxgl.Map): HTMLElement {
        let that = this;
        that.element.innerHTML = `${that.options.htmlContent}`;
        return that.element;
    }

    onRemove(map: mapboxgl.Map): void {
        this.element.remove();
    }

    getDefaultPosition(): string { return this.options.defaultPosition! };

}