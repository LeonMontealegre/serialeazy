import {RootType, Wrapper, DataType, isRef, Ref} from "./Types";

import {CustomBehavior, CustomSerialization,
        SerializableObjects, uuidKey} from "./internal";


function GetMetadataKeys(obj: Object, behavior: CustomBehavior<any>): string[] {
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

export class Serializer {
    private refs: Map<Object, string>;
    private root: RootType;
    private custom: CustomSerialization<any>[];

    public constructor(custom: CustomSerialization<any>[]) {
        this.refs = new Map<Object, string>();
        this.root = {};
        this.custom = custom;
    }

    public findCustomBehavior(obj: Object): CustomBehavior<any> {
        const props = this.custom.find((prop) => obj instanceof prop.type);
        return (props) ? (props.customBehavior) : (undefined);
    }

    public defaultSerialization(obj: Object): any {
        const behavior = this.findCustomBehavior(obj);
        // go through each key and serialize it
        const data = {};
        for (const key of GetMetadataKeys(obj, behavior))
            data[key] = this.serializeProperty(obj[key]);
        return data;
    }

    public serializeProperty(prop: any): any {
        // primitives should be trivially saved
        if (!(prop instanceof Object))
            return prop;

        // if object is a known type then save it as a reference
        if (this.serialize(prop))
            return { "ref": this.refs.get(prop) }

        // TODO: add check for maps/sets/other built-ins
        throw new Error("Unknown property! " + prop.constructor.name);
    }

    public serialize(obj: Object): boolean {
        const uuid = Reflect.getMetadata(uuidKey, obj.constructor.prototype);
        // if it's an unknown type, then we can't serialize it
        if (!uuid)
            return false;
        // if we've already serialized the object then ignore
        if (this.refs.has(obj))
            return true;
        this.refs.set(obj, ""+this.refs.size);

        const newObj: Wrapper = { type: uuid, data: {} };

        const sObj = SerializableObjects.get(uuid);
        const behavior = this.findCustomBehavior(obj);

        // if custom serialization then use that
        const customSerialization = ((behavior ? (behavior.customSerialization) : (undefined)) || sObj.customBehavior.customSerialization);
        if (customSerialization) {
            newObj["data"] = customSerialization(this, obj);
        } else {
            newObj["data"] = this.defaultSerialization(obj);
        }

        this.root[this.refs.get(obj)] = newObj;
        return true;
    }

    public getRoot(): RootType {
        return this.root;
    }
}

function compress(entry: DataType, root: RootType, counts: Map<string, number>): void {
    if (!(entry instanceof Object))
        return;

    const data = entry["data"];

    // Get all entries that are references with exactly 1 reference (in counts)
    const refs = Object.entries(data)
                       .filter(([_, val]) => isRef(val))
                       .map(([key, ref]) => [key, ref["ref"]])
                       .filter(([_, ref]) => counts.get(ref) == 1) as [string, string][];

    // Loop through each of the above entries and compress them, delete them from the
    //  root graph, and add them to their new parent data
    for (const [key, ref] of refs) {
        compress(root[ref], root, counts);
        data[key] = root[ref];
        delete root[ref];
    }
}

export function Compress(root: RootType): void {
    const counts = new Map<string, number>();

    // Get total counts that reference each object
    for (const key of Object.keys(root)) {
        if (!counts.has(key))
            counts.set(key, 1);

        // Look for references in the data of each object
        const data = root[key]["data"];

        // Get all values that are references and map them to the actual reference #
        const refs = Object.values(data)
                           .filter((val) => isRef(val))
                           .map((ref) => ref["ref"]) as string[];

        // Loop through each ref and add it to the counts
        for (const ref of refs) {
            if (!counts.has(ref))
                counts.set(ref, 0);
            counts.set(ref, counts.get(ref) + 1);
        }
    }

    compress(root["0"], root, counts);
}