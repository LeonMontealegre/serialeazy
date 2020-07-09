import "reflect-metadata";

import {RootType} from "./Types";
import {CustomSerialization, SerializableObjects} from "./Serializable";
import {Serializer, Compress} from "./Serialization";
import {Deserializer} from "./Deserialization";
import {CustomBehavior} from "./internal";

import "./BuiltIns";


/*****************************************/
/**   Public facing utility functions    */
/*****************************************/
export function Serialize(obj: any, custom: CustomSerialization<any>[] = []): string {
    if (!(obj instanceof Object))
        return JSON.stringify({ "0": obj });

    const serializer = new Serializer(custom);
    serializer.serialize(obj);

    Compress(serializer.getRoot());

    return JSON.stringify(serializer.getRoot());
}

export function Create<T>(uuid: string): T {
    if (!SerializableObjects.has(uuid))
        return undefined;
    return SerializableObjects.create(uuid) as T;
}

export function GetConstructorFor<T>(uuid: string): new () => T {
    if (!SerializableObjects.has(uuid))
        return undefined;
    return SerializableObjects.get(uuid).constructor;
}

export function Deserialize<T>(str: string): T {
    const root: RootType = JSON.parse(str);
    if (!("0" in root))
        return undefined;

    if (!(root["0"] instanceof Object))
        return root["0"] as T;

    const deserializer = new Deserializer(root);
    return deserializer.deserializeWrapper(root["0"], "0") as T;
}

export function addCustomBehavior<T>(uuid: string, newBehavior: CustomBehavior<T> = {}): void {
    if (!SerializableObjects.has(uuid))
        throw new Error(`Serialize the object (${uuid}) before adding behavior!`);

    const curBehavior = SerializableObjects.get(uuid).customBehavior;
    SerializableObjects.get(uuid).customBehavior = {...curBehavior, ...newBehavior};
}
/*****************************************/

export * from "./Serializable";