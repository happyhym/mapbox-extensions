import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { dom } from 'wheater';
import calLength from '@turf/length';
import calArea from '@turf/area';

import {
    MeasureControl, Measure2Control, SwitchMapControl, BackToOriginControl, DoodleControl, SwitchLayerControl, MarkerControl, ExtendControl,
    SetStyleProxy, MBtnRoate, ExtendControlsWrapper, SwitchLayerGroupsType, LocationControl, ZoomControl, EyeControl, GridControl
} from '../lib';
import '../lib/index.css';

const darkStyle = "mapbox://styles/mapbox/dark-v10";
const lightStyle = 'mapbox://styles/mapbox/light-v11';
let currentStyle = lightStyle;

let useOnlineMap = true;
let mapBaseUrl = `${window.location.origin}`;
let idsseMapBaseUrl = `${window.location.protocol}//${window.location.hostname}:9801/tiles`;
let baseMaps = {
    "IDSSE": `${idsseMapBaseUrl}/geoserver/gwc/service/wmts/rest/ne:gmrt_20231018/5/EPSG:900913/EPSG:900913:{z}/{y}/{x}?format=image/jpeg`,
    //`${idsseMapBaseUrl}/geoserver/gwc/service/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&LAYER=ne:gmrt_20231018&STYLE=&TILEMATRIX=EPSG:900913:{z}&TILECOL={x}&TILEROW={y}&TILEMATRIXSET=EPSG:900913&FORMAT=image/jpeg`
    //idsse wmts：http://10.1.51.234:9801/tiles/geoserver/gwc/service/wmts?service=WMTS&version=1.1.1&request=GetCapabilities
    //`${ idsseMapBaseUrl }/geoserver/gwc/service/wmts/rest/ne:gmrt_20231018/{style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}?format=image/jpeg`
    //`${ idsseMapBaseUrl }/geoserver/gwc/service/wmts?service=WMTS&version=1.1.1&request=GetCapabilities&layer=ne:gmrt_20231018`
    "GMRT": "https://www.gmrt.org/services/mapserver/wms_merc?service=WMS&version=1.1.1&request=GetMap&layers=GMRT&styles=&bbox={bbox-epsg-3857}&width=128&height=128&srs=EPSG:3857&format=image/png&TRANSPARENT=TRUE",
    "GS": "http://115.29.149.99:8066/land22/{z}/{y}/{x}.png",
    "谷歌": useOnlineMap ? "https://gac-geo.googlecnapps.cn/maps/vt?lyrs=y&hl=zh-CN&gl=CN&x={x}&y={y}&z={z}" : `${mapBaseUrl}/api/MapTile/Google/{z}/{y}/{x}`,
    // mt(0—3) Google地图使用了四个服务地址；lyrs=m：路线图，t：地形图，p：带标签的地形图，s：卫星图，y：带标签的卫星图，h：标签层（路名、地名等）
    "高德": useOnlineMap ? 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}' : `${mapBaseUrl}/api/MapTile/高德/{z}/{y}/{x}`,
    // wprd0{1-4}
    // scl=1&style=7 为矢量图（含路网和注记）
    // scl=2&style=7 为矢量图（含路网但不含注记）
    // scl=1&style=6 为影像底图（不含路网，不含注记）
    // scl=2&style=6 为影像底图（不含路网、不含注记）
    // scl=1&style=8 为影像路图（含路网，含注记）
    // scl=2&style=8 为影像路网（含路网，不含注记）
    "高德1": "http://wprd01.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=6",
    //"天地图": "http://t1.tianditu.com/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=4b01c1b56c6bcba2eb9b8e987529c44f",
    "天地图影像1": `http://t${Math.floor(Math.random() * 7)}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=4b01c1b56c6bcba2eb9b8e987529c44f`,
    "天地图影像2": `http://t${Math.floor(Math.random() * 7)}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=4b01c1b56c6bcba2eb9b8e987529c44f`,
    "天地图电子1": `http://t${Math.floor(Math.random() * 7)}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=4b01c1b56c6bcba2eb9b8e987529c44f`,
    "天地图电子2": `http://t${Math.floor(Math.random() * 7)}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=4b01c1b56c6bcba2eb9b8e987529c44f`,
    "天地图地形1": `http://t${Math.floor(Math.random() * 7)}.tianditu.gov.cn/DataServer?T=ter_w&x={x}&y={y}&l={z}&tk=4b01c1b56c6bcba2eb9b8e987529c44f`,
    "天地图地形2": `http://t${Math.floor(Math.random() * 7)}.tianditu.gov.cn/DataServer?T=cta_w&x={x}&y={y}&l={z}&tk=4b01c1b56c6bcba2eb9b8e987529c44f`,
    "OpenStreet": "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "CARTO_BaseMap": "http://www.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "World_Imagery": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    "Esri_DarkGrey": "http://c.sm.mapstack.stamen.com/(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/{z}/{x}/{y}.png",
    "智图": "http://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}",
    "OceanBasemap": "https://server.arcgisonline.com/arcgis/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}.jpg"
}

mapboxgl.accessToken = 'pk.eyJ1IjoiY29jYWluZWNvZGVyIiwiYSI6ImNrdHA1YjlleDBqYTEzMm85bTBrOWE0aXMifQ.J8k3R1QBqh3pyoZi_5Yx9w';

const map = new mapboxgl.Map({
    container: 'map',
    zoom: 6,
    center: [120.5, 31],
    pitch: 0,
    style: {
        "version": 8,
        "name": "default_style",
        //地图雾效果，主要在三维展示
        fog: {
            range: [2, 20],
            color: 'hsl(0, 0%, 100%)',
            'high-color': 'hsl(210, 100%, 80%)',
            'space-color': [
                'interpolate',
                ['exponential', 1.2],
                ['zoom'],
                5,
                'hsl(210, 40%, 30%)',
                7,
                'hsl(210, 100%, 80%)',
            ],
            'horizon-blend': ['interpolate', ['exponential', 1.2], ['zoom'], 5, 0.02, 7, 0.08],
            'star-intensity': ['interpolate', ['exponential', 1.2], ['zoom'], 5, 0.1, 7, 0],
        },
        // mapbox地图使用的图标。
        //"sprite": "mapbox://sprites/mapbox/streets-v8",
        //"sprite": "mapbox://sprites/mapbox/bright-v8",
        //"sprite": `${mapBaseUrl}/sprites/sprite@2x`,
        //"sprite": `${mapBaseUrl}/sprites/sprite`,
        // mapbox地图使用的标注字体。
        "glyphs": "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        // glyphs:"http://207.207.88.59/maptiles/test/fonts/{fontstack}/{range}.pbf", //这个是重点，http://207.207.88.59/maptiles/test/fonts是字体文件路径。
        "sources": {
            "raster_tiles": {
                // 资源的类型，必须是 vector, raster, raster-dem, geojson, image, video中的一种。
                // 当前声明是xyz的png图片组成的底图，所以声明类型是raster。
                "type": "raster",
                'tiles': [
                    // baseMaps.IDSSE,
                    //"https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf" //?sku=101c8tI0zFbh7&access_token=pk.eyJ1IjoiY29jYWluZWNvZGVyIiwiYSI6ImNrdHA1YjlleDBqYTEzMm85bTBrOWE0aXMifQ.J8k3R1QBqh3pyoZi_5Yx9w"
                    //"https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp" //?sku=101c8tI0zFbh7&access_token=pk.eyJ1IjoiY29jYWluZWNvZGVyIiwiYSI6ImNrdHA1YjlleDBqYTEzMm85bTBrOWE0aXMifQ.J8k3R1QBqh3pyoZi_5Yx9w"
                    // baseMaps.谷歌,
                    baseMaps.智图,
                    // baseMaps.GMRT
                    // baseMaps.高德,
                    // baseMaps.CARTO_BaseMap,
                    // baseMaps.World_Imagery,
                    // baseMaps.Esri_DarkGrey,
                    // baseMaps.OceanBasemap,
                    // baseMaps.GS,

                    //"https://wi.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                ],
                "tileSize": 256
            }
        },
        "layers": [{
            "id": "raster_tiles",
            "type": "raster",
            "source": "raster_tiles",
            // "minzoom": 3,
            // "maxzoom": 15
        }]
    },
    attributionControl: false
});

const setStyleProxy = new SetStyleProxy(map);
const mbtnRoate = new MBtnRoate(map);

const layerGroups: SwitchLayerGroupsType = {
    '城市规划': {
        uiType: 'SwitchBtn',
        mutex: true,
        layers: [{
            name: '房屋管理',
            layer: [{
                id: 'fff',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [120.5, 31.1]
                        },
                        properties: { name: '房屋1' }
                    }
                },
                layout: {
                    'text-field': ['get', 'name']
                }
            }],
            'backgroundImage': './assets/house-user.png',
            active: true
        }, {
            name: '建筑群',
            layer: [{
                id: 'fff1',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [120.51, 31.2]
                        },
                        properties: { name: '建筑群1' }
                    }
                },
                layout: {
                    "text-field": ['get', 'name']
                }
            }],
            'backgroundImage': './assets/building.png',
        }, {
            name: '水路规划',
            mutexIdentity: "mutex_test",
            layer: {
                id: 'fff2',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [120.52, 31.1]
                        },
                        properties: { name: '水路1' }
                    }
                },
                layout: {
                    "text-field": ['get', 'name']
                }
            },
            'backgroundImage': './assets/wetland.png',
        }, {
            name: '公路规划',
            layer: {
                id: 'fff3',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [120.53, 31.2]
                        },
                        properties: { name: '公路1' }
                    }
                },
                layout: {
                    "text-field": ['get', 'name']
                }
            },
            'backgroundImage': './assets/road.png',
            easeToOptions: {
                center: [120.53, 31.2]
            }
        }]
    }, '乡村建设': {
        collapse: true,
        mutex: false,
        layers: [{
            name: 'fff4',
            layer: {
                id: 'fff4',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [120.54, 31.1]
                        },
                        properties: { name: 'fff4' }
                    }
                },
                layout: {
                    "text-field": ['get', 'name']
                }
            },
            'backgroundImage': './assets/house-user.png',
            mutex: true
        }, {
            name: 'fff5',
            layer: {
                id: 'fff5',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [120.6, 31.2]
                        },
                        properties: { name: 'fff5' }
                    }
                },
                layout: {
                    "text-field": ['get', 'name'],
                    'text-size': 30,
                }
            },
            'backgroundImage': './assets/building.png',
            'backgroundImageActive': './assets/building-active.png',
            active: true,
        }, {
            name: 'fff6',
            mutexIdentity: "mutex_test",
            layer: {
                id: 'fff6',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [120.6, 31.1]
                        },
                        properties: { name: 'fff6' }
                    }
                },
                layout: {
                    "text-field": ['get', 'name'],
                    'text-size': 30
                }
            },
            'backgroundImage': '',
            active: true,
        }, {
            name: 'fff7',
            layer: [
                {
                    id: 'fff7',
                    type: 'symbol',
                    source: {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [120.64, 31.2]
                            },
                            properties: { name: 'fff7' }
                        }
                    },
                    layout: {
                        "text-field": ['get', 'name'],
                        'text-size': 30
                    },
                    paint: {
                        "text-color": 'red'
                    }
                }, {
                    id: 'fff8',
                    type: 'symbol',
                    source: {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [120.64, 31.1]
                            },
                            properties: { name: 'fff8' }
                        }
                    },
                    layout: {
                        "text-field": ['get', 'name'],
                        'text-size': 30
                    },
                    paint: {
                        "text-color": 'red'
                    }
                }
            ],
            'backgroundImage': '',
            active: true
        }, {
            name: '测试7',
            layer: [
                {
                    id: 'fff11',
                    type: 'symbol',
                    source: {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [120.64, 31.2]
                            },
                            properties: { name: '测试7' }
                        }
                    },
                    layout: {
                        "text-field": ['get', 'name'],
                        'text-size': 30
                    },
                    paint: {
                        "text-color": 'red'
                    }
                }, {
                    id: 'fff12',
                    type: 'symbol',
                    source: {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [120.64, 31.1]
                            },
                            properties: { name: 'fff8' }
                        }
                    },
                    layout: {
                        "text-field": ['get', 'name'],
                        'text-size': 30
                    },
                    paint: {
                        "text-color": 'red'
                    }
                }
            ],
            'backgroundImage': '',
            active: true
        }]
    }
};


let doodleControl: DoodleControl;
let measureControl: MeasureControl;

// 测量
measureControl = new MeasureControl({
    horizontal: true,
    geometryClick: true,
    onGeometryCopy: (geom: string) => { alert(`复制成功 : ${geom}`) },
    onFeatureDelete: (id: string) => { alert(`删除成功 : ${id}`) },
    onStart: () => { doodleControl.stop() },
    onStop: () => { console.log("measure stop") },
    measurePolygonOptions: {
        onDrawed: (id, geometry) => { console.log(id, JSON.stringify(geometry)) }
    }
});

doodleControl = new DoodleControl({
    onStart: () => { measureControl.stop() },
    onDrawed: polygon => { setTimeout(() => { alert(JSON.stringify(polygon)) }, 200) }
})

map.on('load', () => {

    // 切换卫星影像 可以自定义图层
    const switchMapControl = new SwitchMapControl({
        // extra: {
        //     layerGroups
        // }
    });
    map.addControl(switchMapControl);
    switchMapControl.adaptMobile();

    // 加载多个图片
    map.addImages({ 'img1': './assets/relics.png', 'img2': './assets/relics.png' }, () => {
        map.addLayer({
            id: 'images',
            type: 'symbol',
            source: {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: {
                                img: 'img1'
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: [120.5, 31]
                            }
                        },
                        {
                            type: 'Feature',
                            properties: {
                                img: 'img2'
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: [120.6, 31]
                            }
                        }
                    ]
                }
            },
            layout: {
                'icon-image': ['get', 'img']
            }
        })
    });

    map.addControl(measureControl);
    map.addControl(new BackToOriginControl());
    map.addControl(doodleControl);
    map.addControl(new LocationControl({ fractionDigits: 4 }));
    map.addControl(new ZoomControl());
    map.addControl(new mapboxgl.ScaleControl({
        maxWidth: 80,
        unit: 'metric',//imperial'
    }), "top-left");
    map.addControl(new EyeControl(map, { layoutSync: true }));
    map.addControl(new GridControl({ show: true }));

    const content = dom.createHtmlElement("div", ["jas-ctrl-measure-mobile-operation-item"]);
    content.style.width = '200px';
    const titleSlot = dom.createHtmlElement('div');
    titleSlot.innerText = 'slot';
    map.addControl(new ExtendControl({
        content,
        closeable: true,
        title: "tittle",
        titleSlot
    }));

    const measure2Control = new Measure2Control({
        position: 'top-left', measureLineStringOptions: {
            tip: {
                message_drawing: "单击继续, 右击后退, 双击完成测量",
                message_before_drawing: `<div style="background-color:#ccc;color:red">单击开始测量</div>`
            }
        }
    });
    const switchLayerControl = new SwitchLayerControl({
        position: "top-left",
        layerGroups: {
            '可清除可全选': {
                uiType: 'SwitchBtn',
                collapse: true,
                defaultCollapsed: true,
                layers: [{
                    name: "xxx",
                    layer: {
                        id: 'kqc_1',
                        type: 'symbol',
                        source: {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: [120.54, 30.9]
                                },
                                properties: { name: '可清除' }
                            }
                        },
                        layout: {
                            "text-field": ['get', 'name']
                        }
                    }
                }, {
                    name: "xxx1",
                    layer: {
                        id: 'kqc_2',
                        type: 'symbol',
                        source: {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: [120.65, 30.9]
                                },
                                properties: { name: '可清除12' }
                            }
                        },
                        layout: {
                            "text-field": ['get', 'name']
                        }
                    }
                }]
            },
            "经纬度网格": {
                uiType: 'SwitchBtn',
                collapse: true,
                defaultCollapsed: false,
                layers: [{
                    name: "网格线",
                    layer: {
                        id: 'grid-layer',
                        'type': 'line',
                        "source": undefined
                    }
                }, {
                    name: "左侧纬度标签",
                    layer: {
                        'id': 'grid-text-left-layer',
                        'type': 'symbol',
                        "source": undefined
                    }
                }, {
                    name: "右侧纬度标签",
                    layer: {
                        'id': 'grid-text-right-layer',
                        'type': 'symbol',
                        "source": undefined
                    }
                }, {
                    name: "顶部经度标签",
                    layer: {
                        'id': 'grid-text-top-layer',
                        'type': 'symbol',
                        "source": undefined
                    }
                }, {
                    name: "底部经度标签",
                    layer: {
                        'id': 'grid-text-bottom-layer',
                        'type': 'symbol',
                        "source": undefined
                    }
                }]
            }
        }
    });

    map.addControl(measure2Control);
    map.addControl(switchLayerControl);

    const markerControl = new MarkerControl({
        markerOptions: {
            layers: [{
                id: "35ebd84f-1c75-42b3-ba76-568cac847cf5",
                name: "test",
                date: Date.now()-1704038400000
            }],
            featureCollection: { "type": "FeatureCollection", "features": [{ "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[120.33795166015392, 31.155843389096844], [120.33245849609165, 30.95466933754993], [120.68470764159827, 30.975865573909786], [120.64350891112883, 31.155843389096844], [120.33795166015392, 31.155843389096844]]] }, "properties": { "id": "2dae1cb3-f2f9-4c34-b500-8288ed258639", "name": "标注", "layerId": "35ebd84f-1c75-42b3-ba76-568cac847cf5", "date": 1703034323051, "style": { "textSize": 14, "textColor": "black", "textHaloColor": "white", "textHaloWidth": 1, "pointIcon": "标1.png", "pointIconColor": "#ff0000", "pointIconSize": 0.3, "lineColor": "#0000ff", "lineWidth": 3, "polygonColor": "#0000ff", "polygonOpacity": 0.5, "polygonOutlineColor": "#000000", "polygonOutlineWidth": 2 } }, "id": "2dae1cb3-f2f9-4c34-b500-8288ed258639" }, { "type": "Feature", "geometry": { "type": "LineString", "coordinates": [[120.2605379098901, 30.869971361182337], [120.38410169141792, 30.8711497871234], [120.48501211299799, 30.88764622882202], [120.57974434550329, 30.878220038493666], [120.66212019985676, 30.84581043692205], [120.72184269426003, 30.848167868226483]] }, "properties": { "id": "04abb291-814c-4ad1-9f98-6277cdcefd27", "name": "标注", "layerId": "35ebd84f-1c75-42b3-ba76-568cac847cf5", "date": 1703036360925, "style": { "textSize": 19, "textColor": "#00ffff", "textHaloColor": "#000000", "textHaloWidth": 1, "pointIcon": "标1.png", "pointIconColor": "#ff0000", "pointIconSize": 0.3, "lineColor": "#ff0000", "lineWidth": 6, "polygonColor": "#0000ff", "polygonOpacity": 0.5, "polygonOutlineColor": "#000000", "polygonOutlineWidth": 2 } }, "id": "04abb291-814c-4ad1-9f98-6277cdcefd27" }, { "type": "Feature", "geometry": { "type": "Point", "coordinates": [120.2530240890847, 31.09089416247764] }, "properties": { "id": "55942abd-dc73-4f45-9247-2a7926339bde", "name": "标注", "layerId": "35ebd84f-1c75-42b3-ba76-568cac847cf5", "date": 1703036400053, "style": { "textSize": 19, "textColor": "#00ffff", "textHaloColor": "#000000", "textHaloWidth": 1, "pointIcon": "标1.png", "pointIconColor": "#ff0000", "pointIconSize": 0.3, "lineColor": "#ff0000", "lineWidth": 6, "polygonColor": "#0000ff", "polygonOpacity": 0.5, "polygonOutlineColor": "#000000", "polygonOutlineWidth": 2 } }, "id": "55942abd-dc73-4f45-9247-2a7926339bde" }] },
            layerOptions: {
                extraInfo: f => {
                    const g = f.geometry;
                    if (g.type === 'LineString' || g.type === 'MultiLineString') {
                        let length = calLength(f, { units: 'meters' });
                        let units = 'm';
                        if (length > 1000) {
                            length = length / 1000;
                            units = 'km';
                        }
                        return `长度 : ${length.toFixed(2)} ${units}`;
                    } else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
                        let area = calArea(f);
                        let units = 'm²';
                        if (area > 1000000) {
                            area = area / 1000000;
                            units = 'km²';
                        }
                        return `面积 : ${area.toFixed(2)} ${units}`
                    }
                }
            }
        }
    });
    map.addControl(markerControl);
    markerControl.open = true;
    // markerControl.markerManager.markerLayers.pop();

    new ExtendControlsWrapper([measure2Control, switchLayerControl.extendControl]);
})