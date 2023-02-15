import * as turf from '@turf/turf'
import { createUUID } from '../../../utils';


/**
 * 测量功能
 *
 * @abstract
 * @class MeasureBase
 */
export default abstract class MeasureBase {
    readonly sourceId;
    readonly pointSourceId;
    readonly symbolSourceId;
    protected geojson: GeoJSON.FeatureCollection<GeoJSON.Geometry> = {
        type: 'FeatureCollection',
        features: []
    }

    protected geojsonPoint: GeoJSON.FeatureCollection<GeoJSON.Geometry> = {
        type: 'FeatureCollection',
        features: []
    }

    isDrawing = false;

    protected abstract onInit(): void;
    protected abstract onAddPoint(): void;
    protected abstract onRevokePoint(): void;
    protected abstract onFinish(): void;
    protected abstract getCoordinates(): turf.helpers.Position[] | undefined;

    constructor(protected map: mapboxgl.Map) {

        this.sourceId = createUUID()
        this.pointSourceId = createUUID()
        this.symbolSourceId = createUUID()

        this.map.addSource(this.sourceId, {
            type: 'geojson',
            data: this.geojson
        })
        this.map.addSource(this.pointSourceId, {
            type: 'geojson',
            data: this.geojsonPoint
        })

        //onInit 实现添加图层，配置图层样式
        this.onInit();
    };

    protected get currentFeature() {
        return this.isDrawing ? this.geojson.features.at(-1) : undefined;
    }

    /**
     * 判断是否有绘制图层，如果没有，重新添加
     *
     * @memberof MeasureBase
     */
    start() {
        this.map.moveLayer(this.sourceId)
        this.map.moveLayer(this.pointSourceId)
        this.map.moveLayer(this.symbolSourceId)
        if (!this.map.getLayer(this.sourceId)) {
            this.map.addSource(this.sourceId, {
                type: 'geojson',
                data: this.geojson
            })
            this.map.addSource(this.pointSourceId, {
                type: 'geojson',
                data: this.geojsonPoint
            })
            this.onInit()
        }
    }

    /**
     *  画点
     *
     * @abstract
     * @param {Function} [callback]
     * @memberof Draw
     */
    addPoint() {
        // 创建或更新currentFeature 并更新数据源，添加线测量
        this.onAddPoint();
    }

    /**
     * 撤销当前点位
     *
     * @memberof line
     */
    revokePoint() {
        // 判断当前feature是否有点
        if (this.getCoordinates()?.pop()) {
            // 删除最后一个点
            this.geojsonPoint.features.pop()
            this.updateDataSource()
        }
        // 这里面展示没有操作
        this.onRevokePoint();
    }

    /**
     *  结束操作
     *
     * @abstract
     * @memberof Draw
     */
    finish() {
        // isDraw恢复原始
        this.isDrawing = false;
        this.onFinish();
    }

    clear() {
        this.geojson.features.length = 0;
        this.geojsonPoint.features.length = 0;
        this.updateDataSource();
    }

    /**
     *  更新数据源
     * 
     * @protected
     * @memberof MeasureBase
     */
    protected updateDataSource() {
        (this.map.getSource(this.sourceId) as any).setData(this.geojson);
        (this.map.getSource(this.pointSourceId) as any).setData(this.geojsonPoint);
    }
}