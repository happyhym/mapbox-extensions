import { array } from "wheater";
import { download } from '../../../common/io';
import { ExportGeoJsonType } from "../types";
import { ConverterOptions, FileType, IExportConverter, export_converters } from "./ExportConverter";

declare let downloadFile: any;

export default class Exporter {
    private converter: IExportConverter;
    /**
     *
     */
    constructor(converter: IExportConverter | FileType) {
        this.converter = typeof converter === 'string' ?
            array.first(export_converters, x => x.type === converter)! :
            converter;
    }

    export(fileName: string, geojson: ExportGeoJsonType, options?: ConverterOptions) {
        let fn = `${fileName}.${this.converter.type}`;
        // shp file is downloaded in the converter
        if (this.converter.type === 'shp') {
            this.converter.convert(geojson, options, fn);
            return;
        }
        else
            download(fn, this.converter.convert(geojson, options));
    }
}