import "reflect-metadata";

const uuidKey = Symbol("__UUID__");
const typeKey = "type";
const dataKey = "data";

type customBehavior = [(serializer: Serializer, obj: any, refs: Map<Object, string>, root: any, customBehavior: (obj: Object) => boolean) => any,
                       (serializer: Serializer, data: any, refs: Map<string, Object>, root: any) => any];

type serializeProperties = [new () => Object, customBehavior];

class Serializer {
    private serializableObjects: Map<string, serializeProperties>;

    public constructor() {
        this.serializableObjects = new Map<string, serializeProperties>();
    }

    public add(uuid: string, props: serializeProperties): void {
        this.serializableObjects.set(uuid, props);
    }

    public serializeProperty(prop: any, refs: Map<Object, string>, root: any, customBehavior: (obj: Object) => boolean): any {
        // primitives should be trivially saved
        if (!(prop instanceof Object))
            return prop;

        // if object is a known type then save it as a reference
        if (this.serialize(prop, refs, root, customBehavior))
            return { "ref": refs.get(prop) }

        // TODO: add check for maps/sets/other built-ins
        throw new Error("Unknown property! " + prop.constructor.name);
    }
    public serialize(obj: Object, refs: Map<Object, string>, root: any, customBehavior: (obj: Object) => boolean): boolean {
        if (!customBehavior(obj))
            return true;

        const uuid = Reflect.getMetadata(uuidKey, obj.constructor.prototype);
        // if it's an unknown type, then we can't serialize it
        if (!uuid)
            return false;
        // if we've already serialized the object then ignore
        if (refs.has(obj))
            return true;
        refs.set(obj, ""+refs.size);

        const newObj = {};
        newObj[typeKey] = uuid;
        newObj[dataKey] = {};

        // if custom serialization then use that
        if (this.serializableObjects.get(uuid)[1][0]) {
            newObj[dataKey] = this.serializableObjects.get(uuid)[1][0](this, obj, refs, root, customBehavior);
        } else { // otherwise go through each key and serialize it
            // get metadata-defined keys or all keys
            let keys = Reflect.getMetadataKeys(obj).filter(key => key != uuidKey);
            if (keys.length == 0)
                keys = Object.keys(obj);
            keys.forEach((key: string) => {
                newObj[dataKey][key] = this.serializeProperty(obj[key], refs, root, customBehavior);
            });
        }

        root[refs.get(obj)] = newObj;
        return true;
    }

    public create(uuid: string) {
        return new (this.get(uuid)[0])();
    }

    public deserializeProperty(prop: any, refs: Map<string, Object>, root: any): any {
        if (!(prop instanceof Object))
            return prop;

        // reference
        const refNum = prop["ref"];
        if (this.deserialize(refNum, refs, root))
            return refs.get(refNum);

        // TODO: add check for sets/other built-ins
        throw new Error("Unknown property! " + prop.constructor.name);
    }
    public deserialize(num: string, refs: Map<string, Object>, root: any): boolean {
        // check if we already deserialized the given obj
        if (num == undefined || refs.has(num))
            return true;

        // if it's an unknown type, then we can't deserialize it
        const uuid = root[num][typeKey];
        if (!this.serializableObjects.has(uuid))
            return false;

        // custom deserialization
        if (this.serializableObjects.get(uuid)[1][1]) {
            const obj = this.serializableObjects.get(uuid)[1][1](this, root[num][dataKey], refs, root);
            refs.set(num, obj);
        } else {
            // construct object and set it in map
            const obj = this.create(uuid);
            refs.set(num, obj);

            const data = root[num][dataKey];
            for (const key in data) {
                if (key == typeKey)
                    continue;
                obj[key] = this.deserializeProperty(data[key], refs, root);
            }
        }

        return true;
    }

    public has(uuid: string): boolean {
        return this.serializableObjects.has(uuid);
    }

    public get(uuid: string): serializeProperties {
        return this.serializableObjects.get(uuid);
    }
}
const serializer = new Serializer();







/*****************************************/
/**   Public facing utility functions    */
/*****************************************/
export function Serialize(obj: Object, customBehavior: (obj: Object) => boolean = (_) => true): string {
    const root = {};
    serializer.serialize(obj, new Map<Object, string>(), root, customBehavior);
    return JSON.stringify(root);
}

export function Create<T>(uuid: string): T {
    return serializer.create(uuid) as T;
}

export function Deserialize<T>(str: string): T {
    const root = JSON.parse(str);
    const map = new Map<string, Object>();

    serializer.deserialize('0', map, root);

    return map.get('0') as T;
}
/*****************************************/







/*****************************************/
/**              Decorators              */
/*****************************************/
export function serialize(target: any, propertyKey: string): void {
    Reflect.defineMetadata(propertyKey, true, target);
}

export function serializable(uuid: string, customSerialization: customBehavior = [undefined, undefined]): (c: new () => Object) => void {
    return function(constructor: new () => Object): any {
        if (serializer.has(uuid))
            throw new Error("Object with UUID " + uuid + " already exists! Cannot have duplicates!");
        // define uuid in prototype
        Reflect.defineMetadata(uuidKey, uuid, constructor.prototype);
        serializer.add(uuid, [constructor, customSerialization]);
    }
}
/*****************************************/






/*****************************************/
/**       Built-in objects setup         */
/*****************************************/
serializable("Array", [
    (serializer: Serializer, obj: Array<any>, refs: Map<Object, string>, root: any, customBehavior: (obj: Object) => boolean) => {
        return obj.map((v) => serializer.serializeProperty(v, refs, root, customBehavior));
    },
    (serializer: Serializer, data: Array<any>, refs: Map<string, Object>, root: any) => {
        return data.map((v) => serializer.deserializeProperty(v, refs, root));
    }
])(Array);
serializable("Set", [
    (serializer: Serializer, obj: Set<any>, refs: Map<Object, string>, root: any, customBehavior: (obj: Object) => boolean) => {
        return Array.from(obj).map((v) => serializer.serializeProperty(v, refs, root, customBehavior));
    },
    (serializer: Serializer, data: Array<any>, refs: Map<string, Object>, root: any) => {
        return new Set(data.map((v) => serializer.deserializeProperty(v, refs, root)));
    }
])(Set);
serializable("Function", [
    (_: Serializer, obj: Function, __: Map<Object, string>, ___: any) => {
        const uuid = Reflect.getMetadata(uuidKey, obj.prototype);
        if (!uuid)
            throw new Error("Attempted to serialize function that is not serializable! " + obj.name);
        return uuid;
    },
    (serializer: Serializer, data: string, refs: Map<string, Object>, root: any) => {
        return serializer.get(data)[0];
    }
])(Function);
/*****************************************/