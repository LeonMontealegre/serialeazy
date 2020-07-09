import {serializable, uuidKey, SerializableObjects} from "./internal";
import {Serializer} from "./Serialization";
import {Deserializer} from "./Deserialization";

/*****************************************/
/**       Built-in objects setup         */
/*****************************************/
serializable("Array", {
    customSerialization: (serializer: Serializer, obj: any[]) => {
        return obj.map((v) => serializer.serializeProperty(v));
    },
    customDeserialization: (deserializer: Deserializer, obj: any[], data: any[]) => {
        data.forEach((v) => obj.push(deserializer.deserializeProperty(v)));
    }
})(Array);
serializable("Set", {
    customSerialization: (serializer: Serializer, obj: Set<any>) => {
        return Array.from(obj).map((v) => serializer.serializeProperty(v));
    },
    customDeserialization: (deserializer: Deserializer, obj: Set<any>, data: any[]) => {
        data.forEach((v) => obj.add(deserializer.deserializeProperty(v)));
    }
})(Set);
serializable("Function", {
    customSerialization: (_: Serializer, func: Function) => {
        const uuid = Reflect.getMetadata(uuidKey, func.prototype);
        if (!uuid)
            throw new Error("Attempted to serialize function that is not serializable! " + func.name);
        return uuid;
    },
    customConstruction: (data: string) => {
        return SerializableObjects.get(data).constructor;
    },
    customDeserialization: () => {
        // do nothing
    }
})(Function);
serializable("Date", {
    customSerialization: (_: Serializer, date: Date) => {
        return Number(date);
    },
    customConstruction: (data: string) => {
        return new Date(parseInt(data));
    }
})(Date);
/*****************************************/