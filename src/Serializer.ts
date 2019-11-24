import "reflect-metadata";

const VERBOSE = false;

const propsKey = Symbol("__SERIALIZE_PROPS");
const typeKey = "type";
const dataKey = "data";

const serializableObjects = new Map<string, new () => Object>();

// /** Add built-in objects as serializable */
// serializable(Array);
// /*****************************************/

export function Serialize(obj: Object): string {
    const root = {};
    serial(obj, new Map<Object, string>(), root);

    if (VERBOSE)
        console.log("Serialized: ", JSON.stringify(root));

    return JSON.stringify(root);
}

function serializeProp(prop: any, refs: Map<Object, string>, root: any): any {
    // primitives should be trivially saved
    if (!(prop instanceof Object))
        return prop;

    // if object is a known type then save it as a reference
    if (serial(prop, refs, root))
        return { "ref": refs.get(prop) }

    if (prop instanceof Array)
        return prop.map((prop2: any) => serializeProp(prop2, refs, root));

    // TODO: add check for maps/sets/other built-ins
    throw new Error("Unknown property! " + prop);
}

function serial(obj: Object, refs: Map<Object, string>, root: any): boolean {
    // if it's an unknown type, then we can't serialize it
    if (!serializableObjects.has(obj.constructor.name))
        return false;
    // if we've already serialized the object then ignore
    if (refs.has(obj))
        return true;
    refs.set(obj, ""+refs.size);

    const newObj = {};
    newObj[typeKey] = obj.constructor.name;
    newObj[dataKey] = {};

    const keys = Reflect.getMetadata(propsKey, obj);
    keys.forEach((key: string) => {
        newObj[dataKey][key] = serializeProp(obj[key], refs, root);
    });

    root[refs.get(obj)] = newObj;
    return true;
}

function construct(type: string): Object {
    return new (serializableObjects.get(type))();
}

function deserializeProp(prop: any, refs: Map<string, Object>, root: any): any {
    if (!(prop instanceof Object))
        return prop;

    if (prop instanceof Array)
        return prop.map((prop2) => deserializeProp(prop2, refs, root));

    // reference
    const refNum = prop["ref"];
    if (deserial(refNum, refs, root))
        return refs.get(refNum);

    // TODO: add check for maps/sets/other built-ins
    throw new Error("Unknown property! " + prop);
}

function deserial(num: string, refs: Map<string, Object>, root: any): boolean {
    if (refs.has(num))
        return true;

    // if it's an unknown type, then we can't deserialize it
    const type = root[num][typeKey];
    if (!serializableObjects.has(type))
        return false;

    // construct object and set it in map
    const obj = construct(type);
    refs.set(num, obj);

    const data = root[num][dataKey];
    for (const key in data) {
        if (key == typeKey)
            continue;
        obj[key] = deserializeProp(data[key], refs, root);
    }

    return true;
}

export function Deserialize<T>(str: string): T {
    const root = JSON.parse(str);
    const map = new Map<string, Object>();

    deserial('0', map, root);

    if (VERBOSE)
        console.log("Deserialized map: ", map);

    return map.get('0') as T;
}

export function serialize(target: any, propertyKey: string): void {
    if (!Reflect.hasMetadata(propsKey, target))
        Reflect.defineMetadata(propsKey, [], target);
    Reflect.getMetadata(propsKey, target).push(propertyKey);
}

// TODO: enforce UUID for parameter so that classes with same names
//  can be used and also removes depedency of constructor.name
export function serializable(constructor: new () => Object): any {
    const uuid = constructor.name;
    if (serializableObjects.has(uuid))
        throw new Error("Object with UUID " + uuid + " already exists! Cannot have duplicates!");
    serializableObjects.set(uuid, constructor);
}