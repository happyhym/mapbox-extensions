import { IControl, Map } from "mapbox-gl";
import { dom } from 'wheater';

export interface GridControlOptions {
    /**
     * 经纬度保留的小数位数
     */
    fractionDigits?: number;
    /**
     * 是否显示经纬度网格
     */
    show?: boolean;
    /**
     * 经纬度网格/文本颜色
     */
    color?: string;
    /**
     * 经纬度网格/文本大小
     */
    textSize?: number;
    /**
     * 所属的 map 对象的 id
     */
    mapId?: string;
}

/**
 * 经纬度网格控件
 */
export class GridControl implements IControl {

    readonly element = dom.createHtmlElement('div');
    public map?: Map;

    constructor(private options: GridControlOptions = {}) {
        this.options.fractionDigits ??= 0;
        this.options.show ??= true;
        this.options.color ??= "#FFF";
        this.options.textSize ??= 16;
        this.element.setAttribute("id", `${this.options.mapId ?? "map"}-gridControl`);
        this.element.style.display = "";
    }

    setGridVisibility(show?: boolean): void {
        this.options.show = show;
        this.map!.getLayerGroup(`${this.options.mapId}-grid-layers`)!.show = show ?? true;
    }

    public toggleGridVisibility(): void {
        this.options.show=!this.options.show;
        this.setGridVisibility(this.options.show);
    }

    onAdd(map: Map): HTMLElement {
        this.map = map;
        let that = this;

        initGridLayer();
        updateGridLayer();
        this.setGridVisibility(this.options.show);

        function initGridLayer() {
            let gridLayers = map.getLayerGroup(`${that.options.mapId}-grid-layers`);
            if (!gridLayers)
                gridLayers = map.addLayerGroup(`${that.options.mapId}-grid-layers`);
            // 经纬网格
            map.addSource(`${that.options.mapId}-grid-layer`, {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': []
                }
            });
            if (gridLayers.layerIds.indexOf(`${that.options.mapId}-grid-layer`) < 0)
                gridLayers.add({
                    'id': `${that.options.mapId}-grid-layer`,
                    'type': 'line',
                    'source': `${that.options.mapId}-grid-layer`,
                    'layout': {
                        'line-join': 'round',
                        'line-cap': 'round',
                        'visibility': 'none'
                    },
                    'paint': {
                        'line-color': "#4169e1",//that.options.color,
                        'line-width': 1,
                        "line-dasharray": [2, 10],
                        "line-opacity": 0.5
                    }
                });
            // 经纬度刻度
            map.addSource(`${that.options.mapId}-grid-text-left-layer`, {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': []
                }
            });
            if (gridLayers.layerIds.indexOf(`${that.options.mapId}-grid-text-left-layer`) < 0)
                gridLayers.add({
                    'id': `${that.options.mapId}-grid-text-left-layer`,
                    'type': 'symbol',
                    'source': `${that.options.mapId}-grid-text-left-layer`,
                    "layout": {
                        "text-field": ["format", ["get", "col1"], {
                            "text-font": ["literal", ["Open Sans Regular"]],
                            "text-color": that.options.color,
                            "font-scale": 1.0
                        }, " ",
                            ["get", "col2"], {
                                "text-font": ["literal", ["DIN Offc Pro Italic"]],
                                "text-color": that.options.color,
                                "font-scale": 1.0
                            }, " ",
                            ["get", "col3"], {
                                "text-font": ["literal", ["Arial Unicode MS Regular"]],
                                "text-color": that.options.color,
                                "font-scale": 1.0
                            }],
                        "text-size": that.options.textSize,
                        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                        "text-offset": [0.3, 0],
                        "text-anchor": "left",
                        "text-justify": "left",
                        "text-max-width": 20,
                        "text-allow-overlap": false,
                        'visibility': 'none'
                    }
                });
            map.addSource(`${that.options.mapId}-grid-text-right-layer`, {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': []
                }
            });
            if (gridLayers.layerIds.indexOf(`${that.options.mapId}-grid-text-right-layer`) < 0)
                gridLayers.add({
                    'id': `${that.options.mapId}-grid-text-right-layer`,
                    'type': 'symbol',
                    'source': `${that.options.mapId}-grid-text-right-layer`,
                    "layout": {
                        "text-field": ["format", ["get", "col1"], {
                            "text-font": ["literal", ["Open Sans Regular"]],
                            "text-color": that.options.color,
                            "font-scale": 1.0
                        }, " ",
                            ["get", "col2"], {
                                "text-font": ["literal", ["DIN Offc Pro Italic"]],
                                "text-color": that.options.color,
                                "font-scale": 1.0
                            }, " ",
                            ["get", "col3"], {
                                "text-font": ["literal", ["Arial Unicode MS Regular"]],
                                "text-color": that.options.color,
                                "font-scale": 1.0
                            }],
                        "text-size": that.options.textSize,
                        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                        "text-offset": [-3, 0],
                        "text-anchor": "left",
                        "text-justify": "left",
                        "text-max-width": 20,
                        "text-allow-overlap": false,
                        'visibility': 'none'
                    }
                });
            map.addSource(`${that.options.mapId}-grid-text-top-layer`, {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': []
                }
            });
            if (gridLayers.layerIds.indexOf(`${that.options.mapId}-grid-text-top-layer`) < 0)
                gridLayers.add({
                    'id': `${that.options.mapId}-grid-text-top-layer`,
                    'type': 'symbol',
                    'source': `${that.options.mapId}-grid-text-top-layer`,
                    "layout": {
                        "text-field": ["format", ["get", "col1"], {
                            "text-font": ["literal", ["Open Sans Regular"]],
                            "text-color": that.options.color,
                            "font-scale": 1.0
                        }, " ",
                            ["get", "col2"], {
                                "text-font": ["literal", ["DIN Offc Pro Italic"]],
                                "text-color": that.options.color,
                                "font-scale": 1.0
                            }, " ",
                            ["get", "col3"], {
                                "text-font": ["literal", ["Arial Unicode MS Regular"]],
                                "text-color": that.options.color,
                                "font-scale": 1.0
                            }],
                        "text-size": that.options.textSize,
                        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                        "text-offset": [-1.5, 0.6],
                        "text-anchor": "left",
                        "text-justify": "left",
                        "text-max-width": 20,
                        "text-allow-overlap": false,
                        'visibility': 'none'
                    }
                });
            map.addSource(`${that.options.mapId}-grid-text-bottom-layer`, {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': []
                }
            });
            if (gridLayers.layerIds.indexOf(`${that.options.mapId}-grid-text-bottom-layer`) < 0)
                gridLayers.add({
                    'id': `${that.options.mapId}-grid-text-bottom-layer`,
                    'type': 'symbol',
                    'source': `${that.options.mapId}-grid-text-bottom-layer`,
                    "layout": {
                        "text-field": ["format", ["get", "col1"], {
                            "text-font": ["literal", ["Open Sans Regular"]],
                            "text-color": that.options.color,
                            "font-scale": 1.0
                        }, " ",
                            ["get", "col2"], {
                                "text-font": ["literal", ["DIN Offc Pro Italic"]],
                                "text-color": that.options.color,
                                "font-scale": 1.0
                            }, " ",
                            ["get", "col3"], {
                                "text-font": ["literal", ["Arial Unicode MS Regular"]],
                                "text-color": that.options.color,
                                "font-scale": 1.0
                            }],
                        "text-size": that.options.textSize,
                        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                        "text-offset": [-1.5, -0.6],
                        "text-anchor": "left",
                        "text-justify": "left",
                        "text-max-width": 20,
                        "text-allow-overlap": false,
                        'visibility': 'none'
                    }
                });
        }

        function updateGridLayer() {
            let bounds = map.getBounds();
            let sw = bounds.getSouthWest();
            let ne = bounds.getNorthEast();
            let minLng = Math.floor(sw.lng);
            let minLat = Math.floor(sw.lat);
            let maxLng = Math.ceil(ne.lng);
            let maxLat = Math.ceil(ne.lat);
            let d = Math.min(Math.ceil((maxLng - minLng) / 5), Math.ceil((maxLat - minLat) / 5));
            let gridFeatures = [];
            let textLeftFeatures = [];
            let textRigthFeatures = [];
            let textTopFeatures = [];
            let textBottomFeatures = [];
            let zoom = map.getZoom();
            for (let i = 1; i < 12; i++) {
                // 经线
                var lng = lngFix(minLng + d * i);
                gridFeatures.push({
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [[lng, minLat], [lng, maxLat]]
                    }
                });
                // 经度刻度（上）
                textTopFeatures.push({
                    'type': 'Feature',
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lng, ne.lat]
                    },
                    "properties": {
                        "col1": Math.abs(lng),
                        "col2": "°",
                        "col3": lng == 180 ? "" : lng > 0 ? "E" : "W",
                    }
                });
                // 经度刻度（下）
                textBottomFeatures.push({
                    'type': 'Feature',
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lng, sw.lat]
                    },
                    "properties": {
                        "col1": Math.abs(lng),
                        "col2": "°",
                        "col3": lng == 180 ? "" : lng > 0 ? "E" : "W",
                    }
                });
                // 纬线
                var lat = minLat + d * i
                if (lat > 90)
                    continue;
                gridFeatures.push({
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [[minLng, lat], [maxLng, lat]]
                    }
                });
                // 纬度刻度（左）
                textLeftFeatures.push({
                    'type': 'Feature',
                    "geometry": {
                        "type": "Point",
                        "coordinates": [sw.lng, lat]
                    },
                    "properties": {
                        "col1": Math.abs(lat),
                        "col2": "°",
                        "col3": lat > 0 ? "N" : "S",
                    }
                });
                // 纬度刻度（右）
                textRigthFeatures.push({
                    'type': 'Feature',
                    "geometry": {
                        "type": "Point",
                        "coordinates": [ne.lng, lat]
                    },
                    "properties": {
                        "col1": Math.abs(lat),
                        "col2": "°",
                        "col3": lat > 0 ? "N" : "S",
                    }
                });

            }

            // 使用 globe 投影时，根据缩放级别调整文本偏移
            if (map.getProjection().name === "globe") {
                map.setLayoutProperty(`${that.options.mapId}-grid-text-left-layer`, "text-offset", [zoom < 6 ? 6 : 0.5, 0]);
                map.setLayoutProperty(`${that.options.mapId}-grid-text-right-layer`, "text-offset", [zoom < 6 ? -8 : -3, 0]);
                map.setLayoutProperty(`${that.options.mapId}-grid-text-top-layer`, "text-offset", [-1.5, zoom < 4 ? 6 : zoom < 4.5 ? 5 : zoom < 5 ? 4 : zoom < 5.5 ? 3 : zoom < 6 ? 2 : 1]);
                map.setLayoutProperty(`${that.options.mapId}-grid-text-bottom-layer`, "text-offset", [-1.5, zoom < 4 ? -16 : zoom < 4.5 ? -12 : zoom < 5 ? -8 : zoom < 5.5 ? -6 : zoom < 6 ? -5 : -1]);
            }

            (map.getSource(`${that.options.mapId}-grid-layer`) as any).setData({
                'type': 'FeatureCollection',
                'features': gridFeatures
            });
            (map.getSource(`${that.options.mapId}-grid-text-left-layer`) as any).setData({
                'type': 'FeatureCollection',
                'features': textLeftFeatures
            });
            (map.getSource(`${that.options.mapId}-grid-text-right-layer`) as any).setData({
                'type': 'FeatureCollection',
                'features': textRigthFeatures
            });
            (map.getSource(`${that.options.mapId}-grid-text-top-layer`) as any).setData({
                'type': 'FeatureCollection',
                'features': textTopFeatures
            });
            (map.getSource(`${that.options.mapId}-grid-text-bottom-layer`) as any).setData({
                'type': 'FeatureCollection',
                'features': textBottomFeatures
            });
        }

        function lngFix(lng: number) {
            // 大于180度为西经
            if (lng > 180)
                return -(360 - lng);
            // 小于-180度为东经
            if (lng < -180)
                return (360 + lng);
            return lng;
        }

        map.on('moveend', (e) => {
            if (this.options.show)
                updateGridLayer();
        });

        return this.element;
    }

    onRemove(map: Map): void {
        this.element.remove();
    }
}