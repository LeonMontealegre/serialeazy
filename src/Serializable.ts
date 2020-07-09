import {DataType} from "./Types";
import {Serializer, Deserializer} from "./internal";

export const uuidKey = Symbol("__UUID__");

export type CustomBehavior<T> = {
    customSerialization?: (serializer: Serializer, obj: T) => any;
    customConstruction?: (data: DataType) => T,
    customKeyFilter?: (obj: T, key: string) => boolean,
    customDeserialization?: (deserializer: Deserializer, obj: T, data: DataType) => void,
    customPostDeserialization?: (obj: T) => void
}

export type SerializeProperties<T> = {
    constructor: new () => T,
    customBehavior: CustomBehavior<T>
};

export type CustomSerialization<T> = {
    type: Function,
    customBehavior: CustomBehavior<T>
};

export const SerializableObjects = (() => {
    const serializableObjects = new Map<string, SerializeProperties<any>>();
    return {
        add(uuid: string, props: SerializeProperties<any>): void {
            serializableObjects.set(uuid, props);
        },
        create(uuid: string) {
            return new (serializableObjects.get(uuid).constructor)();
        },
        construct(uuid: string, data?: DataType) {
            const customBehavior = serializableObjects.get(uuid).customBehavior;
            return (customBehavior.customConstruction ? customBehavior.customConstruction(data) : this.create(uuid));
        },
        has(uuid: string): boolean {
            return serializableObjects.has(uuid);
        },
        get(uuid: string): SerializeProperties<any> {
            return serializableObjects.get(uuid);
        }
    };
})();


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
        if (SerializableObjects.has(uuid))
            throw new Error("Object with UUID " + uuid + " already exists! Cannot have duplicates!");
        // define uuid in prototype
        Reflect.defineMetadata(uuidKey, uuid, constructor.prototype);
        SerializableObjects.add(uuid, {constructor, customBehavior});
    }
}
/*****************************************/