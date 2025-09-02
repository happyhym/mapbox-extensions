import { toGeoJSON } from 'kml-geojson';
import { GeometryStyle, MarkerFeatrueProperties } from '../types';
import { FeatureCollection, Geometry } from 'geojson';
import { uuid } from 'wheater/dist/utils/creator';

export type FileType = 'shp' | 'geojson' | 'kml';

export type ConverterOptions = {
    defaultStyle?: GeometryStyle
}

export interface IImportConverter {
    readonly type: FileType;
    convert(layerId: string, value: string, options?: ConverterOptions): Promise<GeoJSON.FeatureCollection<GeoJSON.Geometry, MarkerFeatrueProperties>>;
}

export class KmlConverter implements IImportConverter {
    readonly type = 'kml';

    async convert(layerId: string, value: string, options?: ConverterOptions): Promise<FeatureCollection<Geometry, MarkerFeatrueProperties>> {
        const fc = await toGeoJSON(value);

        fc.features.forEach(f => {
            const properties = f.properties!;
            f.id = uuid();
            f.properties = {
                id: f.id,
                name: properties['name'] ?? "",
                layerId,
                date: Date.now() - 1704038400000,
                style: options?.defaultStyle ?? getDefaultStyle(properties)
            }
        });

        return fc as any;
    }
}

export class GeoJsonConverter implements IImportConverter {
    readonly type = 'geojson';

    async convert(layerId: string, value: any, options?: ConverterOptions): Promise<FeatureCollection<Geometry, MarkerFeatrueProperties>> {

        const fc = value;
        fc.features.forEach((f: any) => {
            const properties = f.properties!;
            f.id = uuid();
            f.properties = {
                id: f.id,
                name: properties['name'] ?? "",
                layerId,
                date: Date.now() - 1704038400000,
                style: options?.defaultStyle ?? getDefaultStyle(properties)
            }
        });

        return fc as any;
    }
}

export class ShapeConverter implements IImportConverter {
    readonly type = 'shp';

    async convert(layerId: string, value: any, options?: ConverterOptions): Promise<FeatureCollection<Geometry, MarkerFeatrueProperties>> {

        const fc = value;
        fc.features.forEach((f: any) => {
            const properties = f.properties!;
            f.id = uuid();
            f.properties = {
                id: f.id,
                name: properties['name'] ?? (properties['Name'] ?? (properties['NAME'] ?? "")),
                layerId,
                date: Date.now() - 1704038400000,
                style: options?.defaultStyle ?? getDefaultStyle(properties)
            }
        });

        return fc as any;
    }
}

export const import_converters = [new ShapeConverter(), new GeoJsonConverter(), new KmlConverter()];

function getDefaultStyle(properties: any): GeometryStyle {
    const stroke = properties["stroke"];
    const strokeWidth = properties['stroke-width'];
    const strokeOpacity = properties['stroke-opacity'];
    const fill = properties['fill'];
    const fillOpacity = properties['fill-opacity'];

    return {
        textSize: 14,
        textColor: 'black',
        textHaloColor: 'white',
        textHaloWidth: 1,

        pointIcon: "标1.png",
        pointIconColor: "#ff0000",
        pointIconSize: 0.3,

        lineColor: stroke ?? '#0000ff',
        lineWidth: strokeWidth ?? 3,

        polygonColor: fill ?? '#0000ff',
        polygonOpacity: fillOpacity ?? 0.5,
        polygonOutlineColor: stroke ?? '#000000',
        polygonOutlineWidth: strokeWidth ?? 2,
    }
}