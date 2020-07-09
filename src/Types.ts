
/*****************************************/
/**           Type Definitions           */
/*****************************************/
export type DataType = any;

export type Ref = {ref: string};
export type Wrapper = {type: string, data: DataType};
export type RootType = Record<string, DataType>;

export function isRef(dataType: DataType): dataType is Ref {
    return "ref" in dataType;
}
export function isWrapper(dataType: DataType): dataType is Wrapper {
    return "type" in dataType && "data" in dataType;
}
/*****************************************/