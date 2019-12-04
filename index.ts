import "reflect-metadata";

const uuidKey = Symbol("__UUID__");
const typeKey = "type";
const dataKey = "data";

type CustomBehavior<T> = {
    customSerialization?: (serializer: Serializer, obj: T, refs: Map<Object, string>, root: any, customFilter?: (obj: Object) => boolean) => any;
    customConstruction?: (serializer: Serializer, data: any) => T,
    customDeserialization?: (serializer: Serializer, obj: T, data: any, refs: Map<string, Object>, root: any) => void,
    customPostDeserialization?: (obj: T) => void
}

type SerializeProperties<T> = {
    constructor: new () => T,
    customBehavior: CustomBehavior<T>
};

class Serializer {
    private serializableObjects: Map<string, SerializeProperties<any>>;

    public constructor() {
        this.serializableObjects = new Map<string, SerializeProperties<any>>();
    }

    public add(uuid: string, props: SerializeProperties<any>): void {
        this.serializableObjects.set(uuid, props);
    }

    public serializeProperty(prop: any, refs: Map<Object, string>, root: any, customFilter?: (obj: Object) => boolean): any {
        // primitives should be trivially saved
        if (!(prop instanceof Object))
            return prop;

        // if object is a known type then save it as a reference
        if (this.serialize(prop, refs, root, customFilter))
            return { "ref": refs.get(prop) }

        // TODO: add check for maps/sets/other built-ins
        throw new Error("Unknown property! " + prop.constructor.name);
    }
    public serialize(obj: any, refs: Map<Object, string>, root: any, customFilter?: (obj: Object) => boolean): boolean {
        if (customFilter && !customFilter(obj))
            return true;

        const uuid = Reflect.getMetadata(uuidKey, obj.constructor.prototype);
        // if it's an unknown type, then we can't serialize it
        if (!uuid)
            return false;
        // if we've already serialized the object then ignore
        if (refs.has(obj))
            return true;
        refs.set(obj, ""+refs.size);

        const newObj = {
            [typeKey]: uuid,
            [dataKey]: {}
        };

        const sObj = this.serializableObjects.get(uuid);

        // if custom serialization then use that
        if (sObj.customBehavior.customSerialization) {
            newObj[dataKey] = sObj.customBehavior.customSerialization(this, obj, refs, root, customFilter);
        } else { // otherwise go through each key and serialize it
            // get metadata-defined keys or all keys
            let keys = Reflect.getMetadataKeys(obj).filter(key => key != uuidKey);
            if (keys.length == 0)
                keys = Object.keys(obj);
            keys.forEach((key: string) => {
                newObj[dataKey][key] = this.serializeProperty(obj[key], refs, root, customFilter);
            });
        }

        root[refs.get(obj)] = newObj;
        return true;
    }

    public create(uuid: string) {
        return new (this.get(uuid).constructor)();
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

        const sObj = this.serializableObjects.get(uuid);
        const customBehavior = sObj.customBehavior;

        const data = root[num][dataKey];

        // Construct object and then set it in map as reference
        const obj = (customBehavior.customConstruction ? customBehavior.customConstruction(this, data) : this.create(uuid));
        refs.set(num, obj);

        // Custom deserialization
        if (customBehavior.customDeserialization) {
            customBehavior.customDeserialization(this, obj, data, refs, root);
        } else {
            // Go through each key (except typeKey)
            Object.keys(data).filter(key => key != typeKey).forEach((key => {
                obj[key] = this.deserializeProperty(data[key], refs, root);
            }));
        }

        if (customBehavior.customPostDeserialization)
            customBehavior.customPostDeserialization(obj);

        return true;
    }

    public has(uuid: string): boolean {
        return this.serializableObjects.has(uuid);
    }

    public get(uuid: string): SerializeProperties<any> {
        return this.serializableObjects.get(uuid);
    }
}
const serializer = new Serializer();







/*****************************************/
/**   Public facing utility functions    */
/*****************************************/
export function Serialize(obj: any, customFilter: (obj: Object) => boolean = (_) => true): string {
    if (!(obj instanceof Object))
        return JSON.stringify({ "0": obj });

    const root = {};
    serializer.serialize(obj, new Map<Object, string>(), root, customFilter);
    return JSON.stringify(root);
}

export function Create<T>(uuid: string): T {
    return serializer.create(uuid) as T;
}

export function Deserialize<T>(str: string): T {
    const root = JSON.parse(str);
    if ("0" in root && !(root["0"] instanceof Object))
        return root["0"] as T;

    const map = new Map<string, Object>();

    serializer.deserialize("0", map, root);

    return map.get("0") as T;
}
/*****************************************/







/*****************************************/
/**              Decorators              */
/*****************************************/
export function serialize(target: any, propertyKey: string): void {
    Reflect.defineMetadata(propertyKey, true, target);
}

export function serializable<T>(uuid: string, customBehavior: CustomBehavior<T> = {}): (c: new () => T) => void {
    return function(constructor: new () => T): any {
        if (serializer.has(uuid))
            throw new Error("Object with UUID " + uuid + " already exists! Cannot have duplicates!");
        // define uuid in prototype
        Reflect.defineMetadata(uuidKey, uuid, constructor.prototype);
        serializer.add(uuid, {constructor, customBehavior});
    }
}
/*****************************************/






/*****************************************/
/**       Built-in objects setup         */
/*****************************************/
serializable("Array", {
    customSerialization: (serializer: Serializer, obj: any[], refs: Map<Object, string>, root: any, customFilter: (obj: Object) => boolean) => {
        return obj.map((v) => serializer.serializeProperty(v, refs, root, customFilter));
    },
    customDeserialization: (serializer: Serializer, obj: any[], data: any[], refs: Map<string, Object>, root: any) => {
        data.forEach((v) => obj.push(serializer.deserializeProperty(v, refs, root)));
    }
})(Array);
serializable("Set", {
    customSerialization: (serializer: Serializer, obj: Set<any>, refs: Map<Object, string>, root: any, customFilter: (obj: Object) => boolean) => {
        return Array.from(obj).map((v) => serializer.serializeProperty(v, refs, root, customFilter));
    },
    customDeserialization: (serializer: Serializer, obj: Set<any>, data: any[], refs: Map<string, Object>, root: any) => {
        data.forEach((v) => obj.add(serializer.deserializeProperty(v, refs, root)));
    }
})(Set);
serializable("Function", {
    customSerialization: (_: Serializer, func: Function) => {
        const uuid = Reflect.getMetadata(uuidKey, func.prototype);
        if (!uuid)
            throw new Error("Attempted to serialize function that is not serializable! " + func.name);
        return uuid;
    },
    customConstruction: (serializer: Serializer, data: string) => {
        return serializer.get(data).constructor;
    },
    customDeserialization: () => {
        // do nothing
    }
})(Function);
/*****************************************/