import "reflect-metadata";

const uuidKey = Symbol("__UUID__");
const typeKey = "type";
const dataKey = "data";

type DataType = any;

type Ref = {ref: string};
type Wrapper = {[typeKey]: string, [dataKey]: DataType};
type RootType = Record<string, DataType>;


type CustomBehavior<T> = {
    customSerialization?: (serializer: Serializer, obj: T, refs: Map<Object, string>, root: RootType, custom: CustomSerialization<any>[]) => any;
    customConstruction?: (serializer: Serializer, data: DataType) => T,
    customKeyFilter?: (obj: T, key: string) => boolean,
    customDeserialization?: (serializer: Serializer, obj: T, data: DataType, refs: Map<string, Object>, root: RootType) => void,
    customPostDeserialization?: (obj: T) => void
}

type SerializeProperties<T> = {
    constructor: new () => T,
    customBehavior: CustomBehavior<T>
};

type CustomSerialization<T> = {
    type: Function,
    customBehavior: CustomBehavior<T>
};


function isRef(dataType: DataType): dataType is Ref {
    return "ref" in dataType;
}
function isWrapper(dataType: DataType): dataType is Wrapper {
    return typeKey in dataType && dataKey in dataType;
}


class Serializer {
    private serializableObjects: Map<string, SerializeProperties<any>>;

    public constructor() {
        this.serializableObjects = new Map<string, SerializeProperties<any>>();
    }

    public findCustomBehavior(obj: Object, custom: CustomSerialization<any>[] = []): CustomBehavior<any> {
        const props = custom.find((prop) => obj instanceof prop.type);
        return (props) ? (props.customBehavior) : (undefined);
    }

    public add(uuid: string, props: SerializeProperties<any>): void {
        this.serializableObjects.set(uuid, props);
    }

    public getKeys(obj: Object, behavior: CustomBehavior<any>): string[] {
        // get metadata-defined keys or all keys
        const customFilter = (behavior) ? (behavior.customKeyFilter) : (undefined);

        let keys: string[] = [];

        const metaKeys = Reflect.getMetadataKeys(obj).filter(key => key != uuidKey);

        // If no specification of any properties, then serialize them all
        if (metaKeys.length == 0) {
            keys = Object.keys(obj);
        } else {
            // If keys only specify properties to NOT serialize, then serialize everything else
            if (metaKeys.every(key => Reflect.getMetadata(key, obj) == false)) {
                keys = Object.keys(obj).filter(key => !metaKeys.includes(key));
            } else {
                // Otherwise, serialize only the keys that are specified
                keys = Object.keys(obj).filter(key => Reflect.getMetadata(key, obj) == true);
            }
        }

        // apply custom filter if it is given
        keys = (customFilter) ? (keys.filter((key) => customFilter(obj, key))) : (keys);
        return keys;
    }

    public defaultSerialization(obj: Object, refs: Map<Object, string>, root: RootType, custom: CustomSerialization<any>[] = []): any {
        const behavior = this.findCustomBehavior(obj, custom);
        // go through each key and serialize it
        const data = {};
        this.getKeys(obj, behavior).forEach((key: string) => {
            data[key] = this.serializeProperty(obj[key], refs, root, custom);
        });
        return data;
    }

    public serializeProperty(prop: any, refs: Map<Object, string>, root: RootType, custom: CustomSerialization<any>[] = []): any {
        // primitives should be trivially saved
        if (!(prop instanceof Object))
            return prop;

        // if object is a known type then save it as a reference
        if (this.serialize(prop, refs, root, custom))
            return { "ref": refs.get(prop) }

        // TODO: add check for maps/sets/other built-ins
        throw new Error("Unknown property! " + prop.constructor.name);
    }
    public serialize(obj: Object, refs: Map<Object, string>, root: RootType, custom: CustomSerialization<any>[] = []): boolean {
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
        const behavior = this.findCustomBehavior(obj, custom);

        // if custom serialization then use that
        const customSerialization = ((behavior ? (behavior.customSerialization) : (undefined)) || sObj.customBehavior.customSerialization);
        if (customSerialization) {
            newObj[dataKey] = customSerialization(this, obj, refs, root, custom);
        } else {
            newObj[dataKey] = this.defaultSerialization(obj, refs, root, custom);
        }

        root[refs.get(obj)] = newObj;
        return true;
    }

    public create(uuid: string) {
        return new (this.get(uuid).constructor)();
    }

    public construct(uuid: string, data?: DataType) {
        const customBehavior = this.get(uuid).customBehavior;
        return (customBehavior.customConstruction ? customBehavior.customConstruction(this, data) : this.create(uuid));
    }

    public defaultDeserialize(obj: any, data: DataType, refs: Map<string, any>, root: RootType): void {
        // Go through each key
        Object.keys(data).forEach((key => {
            obj[key] = this.deserializeProperty(data[key], refs, root);
        }));
    }

    public deserialize(uuid: string, obj: any, data: DataType, refs: Map<string, any>, root: RootType): void {
        const customBehavior = this.get(uuid).customBehavior;

        if (customBehavior.customDeserialization) {
            customBehavior.customDeserialization(this, obj, data, refs, root);
        } else {
            this.defaultDeserialize(obj, data, refs, root);
        }

        if (customBehavior.customPostDeserialization)
            customBehavior.customPostDeserialization(obj);
    }

    public deserializeWrapper(wrapper: Wrapper, refs: Map<string, any>, root: RootType, refNum?: string): any {
        const {type, data} = <Wrapper>wrapper;
        if (!this.has(type))
            throw new Error(`Unknown data type ${type}!`);

        const obj = this.construct(type, data);

        if (refNum) // Add to references if given a reference number
            refs.set(refNum, obj);

        this.deserialize(type, obj, data, refs, root);

        return obj;
    }

    public deserializeProperty(prop: DataType, refs: Map<string, any>, root: RootType): any {
        if (!(prop instanceof Object))
            return prop;

        // reference
        if (isRef(prop)) {
            const refNum = prop["ref"];

            // Check if we already deserialized the given obj
            if (/*refNum == undefined || */refs.has(refNum))
                return refs.get(refNum);

            return this.deserializeWrapper(<Wrapper>root[refNum], refs, root, refNum);
        }

        // in-line object
        if (isWrapper(prop))
            return this.deserializeWrapper(<Wrapper>prop, refs, root);

        throw new Error(`Unknown property ${prop}!`);
    }

    public has(uuid: string): boolean {
        return this.serializableObjects.has(uuid);
    }

    public get(uuid: string): SerializeProperties<any> {
        return this.serializableObjects.get(uuid);
    }
}
const serializer = new Serializer();

function compress(entry: DataType, root: RootType, counts: Map<string, number>): void {
    if (!(entry instanceof Object))
        return;

    const data = entry[dataKey];

    Object.keys(data).forEach((key2) => {
        const val = data[key2];
        if (val["ref"]) {
            const ref = val["ref"];
            if (counts.get(ref) == 1) {
                compress(root[ref], root, counts);
                data[key2] = root[ref];
                delete root[ref];
            }
        }
    });
}

function Compress(root: RootType): void {
    const counts = new Map<string, number>();
    Object.keys(root).forEach((key) => {
        if (!counts.has(key))
            counts.set(key, 1);

        const data = root[key][dataKey];
        Object.values(data).forEach((val) => {
            if (val["ref"]) {
                const ref = val["ref"];
                if (!counts.has(ref))
                    counts.set(ref, 0);
                counts.set(ref, counts.get(ref) + 1);
            }
        });
    });
    compress(root["0"], root, counts);
}



/*****************************************/
/**   Public facing utility functions    */
/*****************************************/
export function Serialize(obj: any, custom: CustomSerialization<any>[] = []): string {
    if (!(obj instanceof Object))
        return JSON.stringify({ "0": obj });

    const root: RootType = {};
    serializer.serialize(obj, new Map<Object, string>(), root, custom);

    Compress(root);

    return JSON.stringify(root);
}

export function Create<T>(uuid: string): T {
    if (!serializer.has(uuid))
        return undefined;
    return serializer.create(uuid) as T;
}

export function GetConstructorFor<T>(uuid: string): new () => T {
    if (!serializer.has(uuid))
        return undefined;
    return serializer.get(uuid).constructor;
}

export function Deserialize<T>(str: string): T {
    const root: RootType = JSON.parse(str);
    if (!("0" in root))
        return undefined;

    if (!(root["0"] instanceof Object))
        return root["0"] as T;

    const refs = new Map<string, DataType>();

    return serializer.deserializeWrapper(root["0"], refs, root, "0") as T;
}

export function addCustomBehavior<T>(uuid: string, newBehavior: CustomBehavior<T> = {}): void {
    if (!serializer.has(uuid))
        throw new Error(`Serialize the object (${uuid}) before adding behavior!`);

    const curBehavior = serializer.get(uuid).customBehavior;
    serializer.get(uuid).customBehavior = {...curBehavior, ...newBehavior};
}
/*****************************************/







/*****************************************/
/**              Decorators              */
/*****************************************/
export function serialize(target: any, propertyKey: string): void;
export function serialize(keep?: boolean): (target: any, propertyKey: string) => void;
export function serialize(keepOrTarget?: boolean | any, propertyKey?: string) {
    if (!keepOrTarget || !(keepOrTarget instanceof Object)) {
        const keep = keepOrTarget == undefined ? true : keepOrTarget;
        return function(target: any, propertyKey: string) {
            Reflect.defineMetadata(propertyKey, keep, target);
        }
    }

    const target = keepOrTarget;
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
    customSerialization: (serializer: Serializer, obj: any[], refs: Map<Object, string>, root: RootType, custom: CustomSerialization<any>[] = []) => {
        return obj.map((v) => serializer.serializeProperty(v, refs, root, custom));
    },
    customDeserialization: (serializer: Serializer, obj: any[], data: any[], refs: Map<string, any>, root: RootType) => {
        data.forEach((v) => obj.push(serializer.deserializeProperty(v, refs, root)));
    }
})(Array);
serializable("Set", {
    customSerialization: (serializer: Serializer, obj: Set<any>, refs: Map<Object, string>, root: RootType, custom: CustomSerialization<any>[] = []) => {
        return Array.from(obj).map((v) => serializer.serializeProperty(v, refs, root, custom));
    },
    customDeserialization: (serializer: Serializer, obj: Set<any>, data: any[], refs: Map<string, any>, root: RootType) => {
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
serializable("Date", {
    customSerialization: (_: Serializer, date: Date) => {
        return Number(date);
    },
    customConstruction: (_: Serializer, data: string) => {
        return new Date(parseInt(data));
    }
})(Date);
/*****************************************/
