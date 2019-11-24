import "reflect-metadata";

const VERBOSE = true;

const propsKey = Symbol("__SERIALIZE_PROPS");
const typeKey = "type";
const dataKey = "data";

const serializableObjects = new Map<string, new () => Object>();

// /** Add built-in objects as serializable */
// serializable(Array);
// /*****************************************/

export function Serialize<T>(obj: T): string {
    const root = {};
    serial(obj, new Map<Object, number>(), root);

    if (VERBOSE)
        console.log("Serialized: ", root);

    return JSON.stringify(root);
}

function serial(obj: Object, refs: Map<Object, number>, root: any): boolean {
    // if it's an unknown type, then we can't serialize it
    if (!serializableObjects.has(obj.constructor.name)) {
        console.error("CANT FIND TYPE " + obj.constructor.name + " WHEN SERIALIZING");
        return false;
    }
    // if we've already serialized the object then ignore
    if (refs.has(obj))
        return true;
    refs.set(obj, refs.size);

    const newObj = {};
    newObj[typeKey] = obj.constructor.name;
    newObj[dataKey] = {};

    const keys = Reflect.getMetadata(propsKey, obj);
    keys.forEach((key: string) => {
        const prop = obj[key];
        // primitives should be trivially saved
        if (!(prop instanceof Object)) {
            newObj[dataKey][key] = prop;
            return;
        }

        // TODO: add check for lists/maps/other built-ins

        // add reference
        if (serial(prop, refs, root)) {
            newObj[dataKey][key] = {
                "ref": refs.get(prop)
            }
        }
    });

    root[refs.get(obj)] = newObj;
    return true;
}

function construct(type: string): Object {
    return new (serializableObjects.get(type))();
}

function deserial(num: string, refs: Map<string, Object>, root: any): boolean {
    if (refs.has(num))
        return true;

    // if it's an unknown type, then we can't deserialize it
    const type = root[num][typeKey];
    if (!serializableObjects.has(type)) {
        console.error("CANT FIND TYPE " + type + " WHEN DESERIALIZING");
        return false;
    }

    // construct object and set it in map
    const obj = construct(type);
    refs.set(num, obj);

    const data = root[num][dataKey];
    for (const key in data) {
        if (key == typeKey)
            continue;
        const prop = data[key];
        if (!(prop instanceof Object)) {
            obj[key] = prop;
            continue;
        }

        // reference
        const refNum = prop["ref"];
        if (deserial(refNum, refs, root))
            obj[key] = refs.get(refNum);
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

export function serializable(constructor: new () => Object): any {
    serializableObjects.set(constructor.name, constructor);
}