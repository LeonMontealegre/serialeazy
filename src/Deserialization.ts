import {RootType, DataType, Wrapper, isRef, isWrapper} from "./Types";
import {SerializableObjects} from "./internal";

export class Deserializer {
    private refs: Map<string, any>;
    private root: RootType;

    public constructor(root: RootType) {
        this.refs = new Map<string, any>();
        this.root = root;
    }

    public defaultDeserialize(obj: any, data: DataType): void {
        // Go through each key
        for (const key of Object.keys(data))
            obj[key] = this.deserializeProperty(data[key]);
    }

    public deserialize(uuid: string, obj: any, data: DataType): void {
        const customBehavior = SerializableObjects.get(uuid).customBehavior;

        if (customBehavior.customDeserialization) {
            customBehavior.customDeserialization(this, obj, data);
        } else {
            this.defaultDeserialize(obj, data);
        }

        if (customBehavior.customPostDeserialization)
            customBehavior.customPostDeserialization(obj);
    }

    public deserializeWrapper(wrapper: Wrapper, refNum?: string): any {
        const {type, data} = wrapper;
        if (!SerializableObjects.has(type)) {
            // Assume it's an unregistered Record, and do default deserialization
            const obj = {};
            this.defaultDeserialize(obj, data);
            return obj;
        }

        const obj = SerializableObjects.construct(type, data);

        if (refNum) // Add to references if given a reference number
            this.refs.set(refNum, obj);

        this.deserialize(type, obj, data);

        return obj;
    }

    public deserializeProperty(prop: DataType): any {
        if (!(prop instanceof Object))
            return prop;

        // reference
        if (isRef(prop)) {
            const refNum = prop["ref"];

            // Check if we already deserialized the given obj
            if (this.refs.has(refNum))
                return this.refs.get(refNum);

            return this.deserializeWrapper(<Wrapper>this.root[refNum], refNum);
        }

        // in-line object
        if (isWrapper(prop))
            return this.deserializeWrapper(<Wrapper>prop);

        throw new Error(`Unknown property ${prop}!`);
    }
}
