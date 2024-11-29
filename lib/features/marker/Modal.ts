import { deep, dom } from 'wheater';
import { svg, language, drag } from '../../common';
import { ExportGeoJsonType, MarkerFeatureType, MarkerLayerProperties } from "./types";
import { getMapMarkerSpriteImages } from "./symbol-icon";
import Exporter from "./exporter/Exporter";
import { FileType, export_converters } from "./exporter/ExportConverter";
import { TCoordConvertOptions, TCoordConverterType } from '../../common/proj';
import { PositionOptions } from 'mapbox-gl';

import { getCircleCoordinates } from "./DrawMarker";

const { SvgBuilder } = svg;
const { lang } = language;
const { DragBox } = drag;

const coordConvertOptions: TCoordConvertOptions = {
    type: 'cgcs2000_gauss_kruger',
    lon_0: 120,
    x_0: 500000,
    towgs84: ""
}

// oe: 
// 使用 declare 关键字声明要在 Typescript 中调用已在 Javascript 中定义的全局变量或函数
declare const readonlyLayers: any;

export interface ModalOptions {
    content: HTMLElement | string,
    title?: string,
    onCancel?(): void,
}

export interface ConfirmModalOptions extends ModalOptions {
    onConfirm?(): void,
    withCancel?: boolean
}

export function createModal(options: ModalOptions): [HTMLElement, () => void] {
    const modal = dom.createHtmlElement('div', ['jas-modal']);
    const container = dom.createHtmlElement('div', ['jas-modal-container']);

    const header = dom.createHtmlElement('div', ['jas-modal-header']);
    const titleDiv = dom.createHtmlElement('div', ['jas-modal-header-title']);
    const closeBtn = new SvgBuilder('X').create('svg');

    titleDiv.innerText = options.title ?? '';
    closeBtn.style.cursor = 'pointer'
    closeBtn.addEventListener('click', () => {
        options.onCancel?.call(undefined);
        modal.remove();
    });

    header.append(titleDiv);
    header.append(closeBtn);
    container.append(header);
    container.append(options.content);

    modal.append(container);
    document.body.append(modal);

    container.style.top = '0';
    container.style.left = `${(modal.clientWidth - container.clientWidth) / 2}px`;
    DragBox(container, header)

    const escPress = (e: KeyboardEvent) => {
        if (e.code.toLocaleLowerCase() === 'escape') {
            document.removeEventListener('keydown', escPress);
            options.onCancel?.call(undefined);
            modal.remove();
        }
    }
    document.addEventListener('keydown', escPress);

    const remove = () => {
        modal.remove();
        document.removeEventListener('keydown', escPress);
    }
    return [container, remove];
}

export function createConfirmModal(options: ConfirmModalOptions) {
    options.withCancel ??= true;
    const [container, remove] = createModal(options);
    const footDiv = dom.createHtmlElement('div', ['jas-modal-foot']);

    const confirmBtn = dom.createHtmlElement('button', ['jas-btn', 'jas-btn-confirm']);
    const cancleBtn = dom.createHtmlElement('button', ['jas-btn', 'jas-btn-default']);
    confirmBtn.innerText = lang.confirm;
    cancleBtn.innerText = lang.cancel;

    confirmBtn.addEventListener('click', () => {
        // oe: 判断是否选择了图层和输入了标注名称
        let layerNameRequired = document.getElementById("layerNameRequired") as HTMLInputElement;
        if (layerNameRequired?.value?.trim() === "") {
            alert("请选择图层");
            layerNameRequired.focus();
            return;
        }
        let featureNameRequired = document.getElementById("featureNameRequired") as HTMLInputElement;
        if (featureNameRequired?.value?.trim() === "") {
            alert("请输入标注名称");
            featureNameRequired.focus();
            return;
        }
        let coordinateListRequired = document.getElementById("coordinateListRequired") as HTMLInputElement;
        if (coordinateListRequired?.value?.trim() === "") {
            alert("请输入拐点坐标");
            coordinateListRequired.focus();
            return;
        }
        let featureCentreRequired = document.getElementById("featureCentreRequired") as HTMLInputElement;
        if (featureCentreRequired?.value?.trim() === "") {
            alert("请输入圆心坐标");
            featureCentreRequired.focus();
            return;
        }
        let featureRadiusRequired = document.getElementById("featureRadiusRequired") as HTMLInputElement;
        if (featureRadiusRequired?.value?.trim() === "") {
            alert("请输入圆半径（km）");
            featureRadiusRequired.focus();
            return;
        }

        options.onConfirm?.call(undefined);
        remove();
    });
    cancleBtn.addEventListener('click', () => {
        options.onCancel?.call(undefined);
        remove();
    });

    footDiv.append(confirmBtn);
    if (options.withCancel)
        footDiv.append(cancleBtn);
    container.append(footDiv);
}

export function createExportModal(fileName: string, geojson: ExportGeoJsonType) {

    const createInputBindingElement = makeCIBEFunc();

    const projUI = dom.createHtmlElement('div', [], [
        dom.createHtmlElement('div', ['jas-modal-content-edit-header'], [lang.proj]),
        dom.createHtmlElement('div', ['jas-modal-content-edit-divBorder'], [

            // 选择坐标系
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], ["coord"]),
                dom.createHtmlElement('select', ['jas-select'], [], {
                    onChange: (_, element) => { coordConvertOptions.type = element.selectedOptions[0].value as any; },
                    onInit: element => {
                        element.innerHTML = (["cgcs2000_gauss_kruger", "bj54_gauss_kruger", "wgs84_pseudo_mercator"] as Array<TCoordConverterType>)
                            .map(x => `<option value="${x}" ${x === coordConvertOptions.type ? 'selected' : ''}>${x}</option>`).join('');
                    }
                })
            ]),
            // 中央纬度
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], ["lat_0"]),
                createInputBindingElement(coordConvertOptions, 'lat_0', e => {
                    e.type = 'number';
                    e.max = '90';
                    e.min = '-90';
                })
            ]),

            // 中央经度 
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], ["lon_0"]),
                createInputBindingElement(coordConvertOptions, 'lon_0', e => {
                    e.type = 'number';
                    e.max = '180';
                    e.min = '-180';
                })
            ]),
            // 东向加常数
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], ["x_0"]),
                createInputBindingElement(coordConvertOptions, 'x_0', e => {
                    e.type = 'number';
                })
            ]),
            // 北向加常数
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], ["y_0"]),
                createInputBindingElement(coordConvertOptions, 'y_0', e => {
                    e.type = 'number';
                })
            ]),

            // 4参数或7参数
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], ["towgs84"]),
                createInputBindingElement(coordConvertOptions, 'towgs84', e => {
                    e.type = "text";
                })
            ]),
        ])]);

    let exportFileType: FileType = 'shp';
    projUI.style.display = 'none';
    const label_select = dom.createHtmlElement('div', [], [
        dom.createHtmlElement('span', [], [lang.fileType]),
        dom.createHtmlElement('select', ['jas-select'], [], {
            onChange: (_, element) => {
                exportFileType = element.value as any;

                if (exportFileType === 'dxf')
                    projUI.style.display = '';
                else
                    projUI.style.display = 'none';
            },
            onInit: element => {
                element.innerHTML = export_converters.map(x => `<option value="${x.type}" ${exportFileType === x.type ? 'selected' : ''}>${x.type}</option>`).join('');
            }
        })], {
        onInit: (element) => {
            element.style.display = 'flex';
            element.style.justifyContent = 'space-between';
        }
    });


    const content = dom.createHtmlElement('div', [], [
        label_select,
        projUI
    ]);

    createConfirmModal({
        title: lang.exportItem,
        content,
        onCancel: () => { },
        onConfirm: () => {
            new Exporter(exportFileType).export(fileName, geojson, {
                coordConvertOptions
            });
        }
    })
}

type EditMode = "update" | "create";

function makeCIBEFunc(onPropChange?: <T>(v: T) => void) {
    return function createInputBindingElement<T>(v: T, k: keyof T, config?: (element: HTMLInputElement) => void) {
        const input = dom.createHtmlElement('input', ['jas-input']);
        input.value = (v as any)[k] as string;
        config?.call(undefined, input);
        input.classList.add(input.type);

        input.addEventListener('change', e => {
            const value = (e.target as any).value;
            if (input.type === 'number') {
                const n = Number.parseFloat(value);

                // 超出限定 数据还原不执行更新操作
                if (n > Number.parseFloat(input.max) || n < Number.parseFloat(input.min)) {
                    input.value = (v as any)[k] as string;
                    return;
                }
                v[k] = n as any;
            } else
                v[k] = value;

            onPropChange?.call(undefined, v);
        });

        return input;
    }
}

function makeTextareaFunc(onPropChange?: <T>(v: T) => void) {
    return function createInputBindingElement<T>(v: T, k: keyof T, config?: (element: HTMLTextAreaElement) => void) {
        const textarea = dom.createHtmlElement('textarea', ['jas-input']);
        textarea.value = (v as any)[k] as string;
        config?.call(undefined, textarea);
        textarea.classList.add(textarea.type);

        textarea.addEventListener('change', e => {
            const value = (e.target as any).value;
            if (textarea.type === 'number') {
                const n = Number.parseFloat(value);

                // 超出限定 数据还原不执行更新操作
                // oe: 暂不检查
                // if (n > Number.parseFloat(textarea.max) || n < Number.parseFloat(textarea.min)) {
                //     textarea.value = (v as any)[k] as string;
                //     return;
                // }
                v[k] = n as any;
            } else
                v[k] = value;

            onPropChange?.call(undefined, v);
        });

        return textarea;
    }
}

function makeColorInputFunc(onPropChange?: <T>(v: T) => void) {
    const cinFunc = makeCIBEFunc(onPropChange);
    return function createColorInputBindingElement<T>(v: T, k: keyof T) {
        const container = dom.createHtmlElement('div', ['jas-custom-color-picker']);
        const h5ColorInput = cinFunc(v, k, element => {
            element.type = "color"
        });

        const presetColors = dom.createHtmlElement('div', ['jas-flex-center'])
        presetColors.append(...['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#000000'].map(color => {
            const item = dom.createHtmlElement('div', ['jas-custom-color-item']);
            item.style.backgroundColor = color;

            item.addEventListener('click', () => {
                v[k] = color as any;
                h5ColorInput.value = color;
                onPropChange?.call(undefined, v);
            });

            return item;
        }));

        container.append(presetColors, h5ColorInput);
        return container;
    }
}

export function createMarkerLayerEditModel(layer: MarkerLayerProperties, options: Omit<Omit<Omit<ConfirmModalOptions, 'content'>, 'withCancel'>, 'title'> & {
    mode: EditMode,
}) {
    const layerCopy = deep.clone(layer);
    const content = dom.createHtmlElement('div', ['jas-modal-content-edit']);
    const createInputBindingElement = makeCIBEFunc();

    content.append(lang.nameText, createInputBindingElement(layer, 'name', input => {
        input.type = 'text';
        // oe: 长度由12改为32
        input.maxLength = 32;
        // oe: 添加 name 属性用于判断用户是否填写了标注名称
        input.id = "featureNameRequired";
    }));

    createConfirmModal({
        'title': options.mode === 'update' ? lang.editItem : lang.newItem,
        content,
        onCancel: () => {
            // 数据恢复
            deep.setProps(layerCopy, layer);
            options.onCancel?.call(undefined);
        },
        onConfirm: options.onConfirm
    })
}

export function createFeaturePropertiesEditModal(
    feature: MarkerFeatureType,
    options: Omit<Omit<Omit<ConfirmModalOptions, 'content'>, 'withCancel'>, 'title'> & {
        mode: EditMode,
        layers: MarkerLayerProperties[],
        onPropChange?(): void
    }) {
    const createInputBindingElement = makeCIBEFunc(options.onPropChange);
    const createColorBindingElement = makeColorInputFunc(options.onPropChange);

    // oe: 添加 textarea 坐标编辑框
    const createTextareaBindingElement = makeTextareaFunc(options.onPropChange);

    function createSelectBindingElement<T>(v: T, k: keyof T, config?: (element: HTMLSelectElement) => void) {
        const input = dom.createHtmlElement('select', ['jas-select']);
        input.value = (v as any)[k] as string;
        config?.call(undefined, input);

        input.addEventListener('change', e => {
            v[k] = (e.target as any).value;
        });

        return input;
    }

    const properties = feature.properties;

    if (options.mode === 'create' && (
        !properties.layerId ||
        !options.layers.some(x => x.id === feature.properties.layerId)))
        properties.layerId = options.layers[0].id;

    const propsCopy = deep.clone(properties);
    const geoType = feature.geometry.type;

    const content = dom.createHtmlElement('div', ['jas-modal-content-edit']);

    //#region 添加图层选择
    // oe: 禁止在专属经济区、海岸线、船舶位置和船舶轨迹图层创建元素
    if (options.mode === 'create') {
        content.append(dom.createHtmlElement('div',
            ['jas-modal-content-edit-item'],
            [dom.createHtmlElement('label', [], [lang.chooseLayer]), createSelectBindingElement(properties, 'layerId', x => {
                // options.layers.filter(l => l.name != "专属经济区" && l.name != "Undersea Feature Gazetteer" && l.name != "九段线" && l.name != "海岸线" && l.name != "船舶位置" && l.name != "船舶轨迹").forEach(l => {
                options.layers.filter(l => !readonlyLayers.includes(l.name)).forEach(l => {
                    x.innerHTML += `<option value="${l.id}">${l.name}</option>`
                });
                x.value = properties.layerId;
                x.id = "layerNameRequired";
            })]))
    }
    //#endregion
    content.append(dom.createHtmlElement('div',
        ['jas-modal-content-edit-item'],
        [dom.createHtmlElement('label', [], [lang.markerName]), createInputBindingElement(properties, 'name', input => {
            input.type = 'text';
            // oe: 长度由12改为32
            input.maxLength = 32;
            // oe: 添加 name 属性用于判断用户是否填写了标注名称
            input.id = "featureNameRequired";
        })]));

    // oe: 添加多行文本框，显示鼠标点击的坐标点，允许用户复制或粘贴新的坐标点
    // 格式化 coordinates 为行模式（一行一组坐标，格式：lon,lat）coordinateList
    let setCoordinateList = (f: MarkerFeatureType) => {
        let coords = [];
        const props = f.properties;
        switch (f.geometry.type) {
            case "Point":
                coords.push(f.geometry.coordinates)
                break;
            case "MultiPoint":
                f.geometry.coordinates.forEach(x => {
                    coords.push(x)
                })
                break;
            case "LineString":
                f.geometry.coordinates.forEach(x => {
                    coords.push(x)
                })
                // f.geometry.coordinates = [
                //     [
                //         117.9203664621516,
                //         17.385948782362917
                //     ],
                //     [
                //         116.42009972752288,
                //         16.533380179649114
                //     ]
                // ];
                break;
            case "MultiLineString":
                f.geometry.coordinates.forEach(x => {
                    coords.push(...x)
                })
                break;
            case "Polygon":
                f.geometry.coordinates.forEach(x => {
                    coords.push(...x)
                })
                break;
            case "MultiPolygon":
                f.geometry.coordinates.forEach(x => {
                    x.forEach(y => {
                        coords.push(...y)
                    });
                })
                break;
        }
        let lines = "";
        for (let p of coords)
            lines = lines.concat(`${p[0].toFixed(6)},${p[1].toFixed(6)}\n`)
        // 给 f.properties.coordinateList 赋值，textarea 绑定到 f.properties.coordinateList，coordinateList 也将作为 f.properties 的一部分持久化
        if (f.properties?.centre && f.properties?.radius) {
            // 是圆的话显示圆心和半径
            //var centre = f.properties.centre?.split(",");
            //f.properties.coordinateList = `${Number(centre[0]).toFixed(6)},${Number(centre[1]).toFixed(6)}\n${f.properties.radius.toFixed(6)}`;
            f.properties.coordinateList = `${f.properties.centre}\n${f.properties.radius}`;
        }
        else {
            // 其他的显示拐点坐标列表
            f.properties.coordinateList = lines;
        }
        return lines;
    }
    // 将行模式（一行一组坐标，格式：lon,lat）的 coordinateList 赋值给 coordinates（实现用户粘贴坐标的功能）
    let updateCoordinates = (f: MarkerFeatureType) => {
        // 清空原 coordinates
        switch (f.geometry.type) {
            case "Point":
                f.geometry.coordinates = [];
                break;
            case "MultiPoint":
                f.geometry.coordinates = [];
                break;
            case "LineString":
                f.geometry.coordinates = [];
                break;
            // case "MultiLineString":
            //     f.geometry.coordinates.forEach(x => {
            //         coords.push(...x)
            //     })
            //     break;
            case "Polygon":
                f.geometry.coordinates[0] = [];
                break;
            // case "MultiPolygon":
            //     f.geometry.coordinates.forEach(x => {
            //         x.forEach(y => {
            //             coords.push(...y)
            //         });
            //     })
            //     break;
        }

        // 是圆的话通过圆心和半径计算拐点坐标
        if (f.properties?.centre && f.properties?.radius && f.geometry.type === "Polygon") {
            // var centre_radius = f.properties.coordinateList?.split("\n");
            // // 第一行是圆心的经纬度
            // var centre = centre_radius![0].split(",");
            // f.properties.centre = [Number(centre[0]), Number(centre[1])];
            // // 第二行是圆半径（单位：km）
            // f.properties.radius = Number(centre_radius![1]);
            // f.geometry.coordinates[0] = getCircleCoordinates(f.properties.centre, f.properties.radius);

            // var centre_radius = f.properties.coordinateList?.split("\n");
            // // 第一行是圆心的经纬度
            // var centre = centre_radius![0].split(",");
            // f.properties.centre = [Number(centre[0]), Number(centre[1])];
            // // 第二行是圆半径（单位：km）
            // f.properties.radius = Number(centre_radius![1]);

            // console.log(`${f.properties.centre}--${f.properties.radius}`);
            var centre = f.properties.centre?.split(",");
            // 默认 km
            if (!f.properties.scale)
                f.properties.scale = 1;

            f.geometry.coordinates[0] = getCircleCoordinates([dmsConvert(centre[0]), dmsConvert(centre[1])], f.properties.radius * f.properties.scale);
        }
        else {
            // 重新赋值（可通过判断 textarea 内容是否变化决定是否重新赋值）
            f.properties.coordinateList?.split("\n").forEach((line) => {
                if (line.trim() === "")
                    return;
                // 度分、度分秒转换为度                
                let c = line.split(",");
                switch (f.geometry.type) {
                    case "Point":
                        f.geometry.coordinates = [dmsConvert(c[0]), dmsConvert(c[1])];
                        break;
                    case "MultiPoint":
                        f.geometry.coordinates.push([dmsConvert(c[0]), dmsConvert(c[1])]);
                        break;
                    case "LineString":
                        f.geometry.coordinates.push([dmsConvert(c[0]), dmsConvert(c[1])]);
                        break;
                    // case "MultiLineString":
                    //     f.geometry.coordinates.forEach(x => {
                    //         coords.push(...x)
                    //     })
                    //     break;
                    case "Polygon":
                        f.geometry.coordinates[0].push([dmsConvert(c[0]), dmsConvert(c[1])]);
                        break;
                    // case "MultiPolygon":
                    //     f.geometry.coordinates.forEach(x => {
                    //         x.forEach(y => {
                    //             coords.push(...y)
                    //         });
                    //     })
                    //     break;
                }
            });
        }
    }
    setCoordinateList(feature);

    // oe: 坐标列表文本框
    if (!properties?.centre && !properties?.radius)
        content.append(dom.createHtmlElement('div',
            ['jas-modal-content-edit-item'],
            [dom.createHtmlElement('label', [], ["拐点坐标"]), createTextareaBindingElement(properties, 'coordinateList', textarea => {
                textarea.rows = 5;
                // oe: 添加 name 属性用于判断用户是否填写了坐标列表
                textarea.id = "coordinateListRequired";
                textarea.title = "每行一组，格式：lng,lat（支持度、度分、度分秒格式）";
            })]));
    // oe: 圆心坐标编辑文本框
    if (properties?.centre)
        content.append(dom.createHtmlElement('div',
            ['jas-modal-content-edit-item'],
            [dom.createHtmlElement('label', [], ["圆心坐标"]), createInputBindingElement(properties, 'centre', input => {
                input.type = 'text';
                // oe: 长度有12改为32
                input.maxLength = 32;
                // oe: 添加 name 属性用于判断用户是否填写了圆心经纬度
                input.id = "featureCentreRequired";
                input.title = "格式：lng,lat（支持度、度分、度分秒格式）";
            })]));
    // oe: 半径编辑文本框
    if (properties?.radius) {
        content.append(dom.createHtmlElement('div',
            ['jas-modal-content-edit-item'],
            [dom.createHtmlElement('label', [], ["半径"]), createInputBindingElement(properties, 'radius', input => {
                input.type = 'text';
                input.maxLength = 12;
                // oe: 添加 name 属性用于判断用户是否填写了半径
                input.id = "featureRadiusRequired";
                input.title = "圆半径大小";
            }), dom.createHtmlElement('select', ['jas-select'], [], {
                onChange: (_, element) => { feature.properties.scale = element.selectedOptions[0].value as any; },
                onInit: element => {
                    element.innerHTML = ([{ name: "km", scale: 1 }, { name: "nm", scale: 1.852 }, { name: "m", scale: 0.001 }] as Array<any>)
                        .map(x => `<option value="${x.scale}" ${x.scale == feature.properties.scale ? 'selected' : ''}>${x.name}</option>`).join('');
                }
            })]));
    }

    // 选择经纬度格式，度/度分/度分秒，（功能未完成，待完成后启用）
    // content.append(dom.createHtmlElement('div',
    //     ['jas-modal-content-edit-item'],
    //     [dom.createHtmlElement('label', [], ["经纬度格式"]), dom.createHtmlElement('label', ["_d"], ["度"]), createInputBindingElement(properties, '_d', input => {
    //         input.type = 'radio';
    //         input.id = "_d";
    //         input.name = "dms_format";
    //         input.title = "度格式";
    //         input.style.width = '5px';
    //     }), dom.createHtmlElement('label', ["_dm"], ["度分"]), createInputBindingElement(properties, '_dm', input => {
    //         input.type = 'radio';
    //         input.id = "_dm";
    //         input.name = "dms_format";
    //         input.title = "度分格式";
    //         input.style.width = '10px';
    //     }), dom.createHtmlElement('label', ["_dms"], ["度分秒"]), createInputBindingElement(properties, '_dms', input => {
    //         input.type = 'radio';
    //         input.id = "_dms";
    //         input.name = "dms_format";
    //         input.title = "度分秒格式";
    //         input.style.width = '15px';
    //     })]));

    // document.getElementById("_d")!.addEventListener('input', function () {
    //     alert("_d");
    // });
    // document.getElementById("_dm")!.addEventListener('input', function () {
    //     alert("_dm");
    // });
    // document.getElementById("_dms")!.addEventListener('input', function () {
    //     alert("_dms");
    // });

    content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-header'], [lang.word]));

    content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-divBorder'],
        [dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [dom.createHtmlElement('label', [], [lang.fontColor]), createColorBindingElement(properties.style, 'textColor')]),
        dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [dom.createHtmlElement('label', [], [lang.fontSize]),
        createInputBindingElement(properties.style, 'textSize', input => {
            input.type = 'number';
            input.min = '1';
            input.max = '30';
        })]),
        dom.createHtmlElement('div', ['jas-modal-content-edit-item'],
            [dom.createHtmlElement('label', [], [lang.textHaloColor]), createColorBindingElement(properties.style, 'textHaloColor')]),
        dom.createHtmlElement('div', ['jas-modal-content-edit-item'],
            [dom.createHtmlElement('label', [], [lang.textHaloWidth]), createInputBindingElement(properties.style, 'textHaloWidth', input => {
                input.type = 'number';
                input.min = '1';
                input.max = '10';
            })]),
        ]))



    if (geoType === 'Point' || geoType === 'MultiPoint') {
        getMapMarkerSpriteImages(images => {
            const imagesContainer = dom.createHtmlElement('div');
            imagesContainer.style.width = '300px';
            imagesContainer.style.height = '120px';
            imagesContainer.style.overflowY = 'auto';

            let lastClickImg: HTMLImageElement;

            images.forEach((v, k) => {
                const imgElement = dom.createHtmlElement('img');
                imgElement.src = v.url;
                imgElement.height = 30;
                imgElement.width = 30;
                imagesContainer.append(imgElement);

                imgElement.style.cursor = 'pointer';
                imgElement.style.borderRadius = '4px';
                imgElement.style.padding = '4px';

                if (properties.style.pointIcon === k) {
                    imgElement.style.backgroundColor = '#ccc';
                    lastClickImg = imgElement;
                }

                imgElement.addEventListener('click', () => {
                    if (lastClickImg)
                        lastClickImg.style.backgroundColor = '#fff';
                    imgElement.style.backgroundColor = '#ccc';
                    lastClickImg = imgElement;
                    properties.style.pointIcon = k;
                    options.onPropChange?.call(undefined);
                });
            });


            content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-header'], [lang.pointIcon]))
            content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-divBorder'], [
                dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                    dom.createHtmlElement('label', [], [lang.iconText]), imagesContainer]),
                dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                    dom.createHtmlElement('label', [], [`${lang.iconText}颜色`]), createColorBindingElement(properties.style, 'pointIconColor')]),
                dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                    dom.createHtmlElement('label', [], [lang.iconSize]), createInputBindingElement(properties.style, 'pointIconSize', input => {
                        input.type = 'number';
                        input.min = '0.1';
                        input.step = '0.1';
                        input.max = '1';
                    })])
            ]))
        });
    }
    else if (geoType === 'LineString' || geoType === 'MultiLineString') {

        content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-header'], [lang.line]))
        content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-divBorder'], [
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], [lang.lineColor]), createColorBindingElement(properties.style, 'lineColor')]),
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], [lang.lineWidth]), createInputBindingElement(properties.style, 'lineWidth', input => {
                    input.type = 'number';
                    input.min = '1';
                    input.step = '1';
                    input.max = '10';
                })])
        ]))
    }
    else if (geoType === 'Polygon' || geoType === 'MultiPolygon') {

        content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-header'], [lang.outline]))
        content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-divBorder'], [
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], [lang.polygonOutlineColor]), createColorBindingElement(properties.style, 'polygonOutlineColor')]),
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], [lang.polygonOutlineWidth]), createInputBindingElement(properties.style, 'polygonOutlineWidth', element => {
                    element.type = 'number';
                    element.min = '1';
                    element.step = '1';
                    element.max = '10';
                })])
        ]));

        content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-header'], [lang.polygon]))
        content.append(dom.createHtmlElement('div', ['jas-modal-content-edit-divBorder'], [
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], [lang.polygonColor]), createColorBindingElement(properties.style, 'polygonColor')]),
            dom.createHtmlElement('div', ['jas-modal-content-edit-item'], [
                dom.createHtmlElement('label', [], [lang.polygonOpacity]), createInputBindingElement(properties.style, 'polygonOpacity', element => {
                    element.type = 'number'
                    element.min = '0';
                    element.step = '0.1';
                    element.max = '1';
                })])
        ]));
    }

    createConfirmModal({
        'title': options.mode === 'update' ? lang.editItem : lang.newItem,
        content,
        onCancel: () => {
            // 数据恢复
            feature.properties = propsCopy;
            options.onCancel?.call(undefined);
            options.onPropChange?.call(undefined);
        },
        onConfirm: () => {
            // oe: 将行模式（一行一组坐标，格式：lon,lat）的 coordinateList 赋值给 coordinates（实现用户粘贴坐标的功能）
            //alert(feature.properties.coordinateList);
            updateCoordinates(feature);

            options.onConfirm?.call(feature);
        }
        //onConfirm: options.onConfirm
    })
}

function dmsConvert(dms: string): number {
    dms = dms.trim();
    let _d: boolean = dms.includes("°");
    let _m: boolean = dms.includes("′");
    let _s: boolean = dms.includes("″");
    if (!_d && !_m && !_s)
        // 不含°′″，如：112.5
        return Number(dms)
    else if (_d && !_m && !_s)
        // 度格式，如：112.5°，去掉°
        return Number(dms.substring(0, dms.indexOf("°")))
    else if (_d && _m && !_s) {
        // 度分格式，如：112.2°32.6′，去掉° ′
        let d: string = dms.substring(0, dms.indexOf("°"));
        let m: string = dms.substring(dms.indexOf("°") + 1, dms.indexOf("′"));
        return Number(d) + Number(m) / 60;
    }
    else if (_d && _m && _s) {
        // 度分格式，如：112.2°32.6′22.8″，去掉° ′ ″
        let d: string = dms.substring(0, dms.indexOf("°"));
        let m: string = dms.substring(dms.indexOf("°") + 1, dms.indexOf("′"));
        let s: string = dms.substring(dms.indexOf("′") + 1, dms.indexOf("″"));
        return Number(d) + Number(m) / 60 + Number(s) / 3600;
    }
    else {
        alert("数据无效");
        return 0;
    }
}