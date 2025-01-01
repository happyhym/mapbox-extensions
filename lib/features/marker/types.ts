export interface GeometryStyle {
    textSize?: number,
    textColor?: string,
    textHaloWidth?: number,
    textHaloColor?: string,

    pointIcon?: string,
    pointIconSize?: number,
    pointIconColor?: string,

    lineColor?: string,
    lineWidth?: number,

    polygonColor?: string,
    polygonOpacity?: number,
    polygonOutlineColor?: string,
    polygonOutlineWidth?: number,

    // 显示/隐藏图标的初始状态
    visibility?: string
}

export interface MarkerFeatrueProperties {
    id: string,
    name: string,
    layerId: string,
    description?: string;
    date: number,
    style: GeometryStyle,
    show?: boolean;
    // oe: 以回车换行为分隔符的坐标列表
    // lon1,lat1
    // lon2,lat2
    // ...
    coordinateList?: string,
    // oe: 是圆形时，保存圆心和半径
    centre?: string,
    radius?: number,
    // 单位换算比例，以 km 为1，则 nm=1.852、m=0.001
    scale?: number,
    // 度格式的经纬度坐标
    _d?: string,
    // 度分格式的经纬度坐标
    _dm?: string,
    // 度分秒格式的经纬度坐标
    _dms?: string
}

export interface MarkerLayerProperties {
    id: string,
    name: string,
    date: number,
    // oe: 默认的显隐状态
    show?: boolean
}

export type MarkerFeatureType = GeoJSON.Feature<GeoJSON.Geometry, MarkerFeatrueProperties>;

export type ExportGeoJsonType = MarkerFeatureType | GeoJSON.FeatureCollection<GeoJSON.Geometry, MarkerFeatrueProperties>;