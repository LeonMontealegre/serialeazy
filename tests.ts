import "jest";
import {inspect} from "util";
import {serialize, serializable, Serialize, Deserialize, Create, addCustomBehavior} from "./src/index";


// Useful common classes
@serializable("Vector")
class Vector {
    x: number;
    y: number;

    public constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }
}

@serializable("Transform")
class Transform {
    pos: Vector;
    size: Vector;
    rotation: number;

    public constructor(pos: Vector = new Vector(), size: Vector = new Vector(), rotation: number = 0) {
        this.pos = pos;
        this.size = size;
        this.rotation = rotation;
    }
}


describe("Test Suite", () => {
    test(" 0 – Very basic class serialization", () => {
        const t = new Transform(new Vector(2, 2), new Vector(3, 3), 25);

        const str = Serialize(t);
        const t_copy = Deserialize<Transform>(str);

        expect(t).toEqual(t_copy);
    });
    test(" 1 – Basic class serialization", () => {
        @serializable("C")
        class C {
            @serialize tag: string;

            doThing(): string {
                return "C " + this.tag;
            }
        }
        @serializable("A")
        class A {
            @serialize tag: string;
            @serialize connection: C;
        }
        @serializable("B")
        class B {
            @serialize a1: A;
            @serialize a2: A;
        }

        const b = new B();
        const c = new C();
        c.tag = "C";
        const a1 = new A();
        a1.tag = "a1";
        a1.connection = c;
        const a2 = new A();
        a2.tag = "a2";
        a2.connection = c;
        b.a1 = a1;
        b.a2 = a2;

        const str = Serialize(b);

        const b_copy = Deserialize<B>(str);
        const a1_copy = b_copy.a1;
        const a2_copy = b_copy.a2;
        const c_copy = a1_copy.connection;

        expect(c_copy.tag).toEqual(c.tag);
        expect(a1_copy.tag).toEqual(a1.tag);
        expect(a2_copy.tag).toEqual(a2.tag);
        expect(a1_copy.connection).toBe(a2_copy.connection);
        expect(c_copy.doThing()).toEqual(c.doThing());
    });
    test(" 2 – Array of mixed references and custom classes", () => {
        @serializable("Test")
        class Test {
            @serialize things: any[];
        }
        @serializable("Obj")
        class Obj {
            @serialize tag: string;
        }

        const o1 = new Obj();
        o1.tag = "obj1";
        const o2 = new Obj();
        o2.tag = "obj2";
        const o3 = new Obj();
        o3.tag = "obj3";

        const t = new Test();
        t.things = ["0", 5, o1, "asd", o2, 324, o3, o1];

        const str = Serialize(t);

        const t_copy = Deserialize<Test>(str);

        expect(t_copy.things).toHaveLength(t.things.length);
        expect(t_copy.things[0]).toEqual(t.things[0]);
        expect(t_copy.things[1]).toEqual(t.things[1]);
        expect(t_copy.things[3]).toEqual(t.things[3]);
        expect(t_copy.things[5]).toEqual(t.things[5]);

        expect(t_copy.things[2].tag).toEqual(t.things[2].tag);
        expect(t_copy.things[4].tag).toEqual(t.things[4].tag);
        expect(t_copy.things[6].tag).toEqual(t.things[6].tag);
        expect(t_copy.things[7]).toEqual(t_copy.things[2]);
    })
    test(" 3 – Basic cyclical dependencies", () => {
        @serializable("Test2")
        class Test2 {
            @serialize child: Test3;
        }
        @serializable("Test3")
        class Test3 {
            @serialize parent: Test2;
        }

        const t2 = new Test2();
        const t3 = new Test3();
        t2.child = t3;
        t3.parent = t2;

        const str = Serialize(t2);
        const t2_copy = Deserialize<Test2>(str);

        expect(t2_copy.child.parent).toBe(t2_copy);
    });
    test(" 4 – Complex cyclical graph", () => {
        @serializable("Root")
        class Root {
            @serialize name: string;
            @serialize root: Node;
        }
        @serializable("Node")
        class Node {
            @serialize root: Root;
            @serialize tag: string;
            @serialize connections: Connection[];
        }
        @serializable("Connection")
        class Connection {
            @serialize tag: string;
            @serialize input: Node;
            @serialize output: Node;
        }

        const root = new Root();
        root.name = "ROOT";

        const rootNode = new Node();
        root.root = rootNode;
        rootNode.root = root;
        rootNode.tag = "Root Node";
        rootNode.connections = [];

        const n1 = new Node();
        n1.root = root;
        n1.tag = "Node 1";
        n1.connections = [];

        const n2 = new Node();
        n2.root = root;
        n2.tag = "Node 2";
        n2.connections = [];

        const c1 = new Connection();
        c1.tag = "Connection 1";
        c1.input = rootNode;
        c1.output = n1;
        rootNode.connections.push(c1);
        n1.connections.push(c1);

        const c2 = new Connection();
        c2.tag = "Connection 2";
        c2.input = rootNode;
        c2.output = n2;
        rootNode.connections.push(c2);
        n2.connections.push(c2);

        const c3 = new Connection();
        c3.tag = "Connection 3";
        c3.input = n1;
        c3.output = n2;
        n1.connections.push(c3);
        n2.connections.push(c3);

        const str = Serialize(root);
        const root_copy = Deserialize<Root>(str);

        expect(inspect(root, {colors: true, depth: 15})).toEqual(inspect(root_copy, {colors: true, depth: 15}));
    });
    test(" 5 – Sets", () => {
        @serializable("Test5")
        class Test5 {
            @serialize things: Set<any>;
        }

        const s = new Set<any>();
        s.add(5);
        s.add("S");
        s.add(new Set<any>([1,2,3,4]));
        s.add(["i", "am", "Array"]);
        s.add(123);

        const t = new Test5();
        t.things = s;

        const str = Serialize(t);
        const t_copy = Deserialize<Test5>(str);

        const s1 = Array.from(t.things);
        const s2 = Array.from(t_copy.things);

        expect(s2).toHaveLength(s1.length);
        expect(t_copy.things).toBeInstanceOf(Set);
        expect(s2[0]).toEqual(s1[0]);
        expect(s2[1]).toEqual(s1[1]);
        expect(s2[4]).toEqual(s1[4]);

        expect(s2[2]).toBeInstanceOf(Set);
        expect(s2[2].size).toEqual(s1[2].size);

        expect(s2[3]).toBeInstanceOf(Array);
        expect(s2[3]).toHaveLength(s1[3].length);
    });
    test(" 6 – Array of mixed types with other arrays and references", () => {
        @serializable("Test6")
        class Test6 {
            @serialize arr: Array<any>;
        }

        const a = [1,2,3,4];

        const t = new Test6();
        t.arr = [5, "asd", a, [5,5,6,7], a];

        const str = Serialize(t);
        const t_copy = Deserialize<Test6>(str);

        expect(t_copy.arr).toHaveLength(t.arr.length);
        expect(t_copy.arr[0]).toEqual(t.arr[0]);
        expect(t_copy.arr[1]).toEqual(t.arr[1]);
        expect(t_copy.arr[2]).toEqual(t.arr[2]);
        expect(t_copy.arr[3]).toEqual(t.arr[3]);
        expect(t_copy.arr[4]).toEqual(t.arr[4]);
        expect(t_copy.arr[2]).toBe(t_copy.arr[4]);
    });
    test(" 7 – Array of numbers", () => {
        const str = Serialize([1,2,3,4]);
        const arr = Deserialize<Array<number>>(str);

        expect(arr).toEqual([1,2,3,4]);
    });
    test(" 8 – Array of mixed types and cyclical references", () => {
        const a1 = [1,2,3,4];
        const str = Serialize([1, "asd", 4, a1, 7, a1]);
        const arr = Deserialize<Array<any>>(str);

        expect(arr).toHaveLength(6);
        expect(arr[0]).toEqual(1);
        expect(arr[1]).toEqual("asd");
        expect(arr[2]).toEqual(4);
        expect(arr[3]).toEqual(a1);
        expect(arr[4]).toEqual(7);
        expect(arr[5]).toEqual(a1);

        expect(arr[3]).toBe(arr[5]);
    });
    test(" 9 – Classes with arrays of differing types", () => {
        @serializable("Test9asd")
        class Test9 {
            // @serialize
            public list: Array<any>;

            public doThing(): void {
                console.log("idk");
            }
        }

        @serializable("Test9b")
        class Test9b extends Test9 {
            // @serialize
            public list: Array<number>;

            // @serialize
            public name: string;
        }

        const t1 = new Test9b();
        t1.list = [1,2,4];
        t1.name = "test9b";

        const t2 = new Test9();
        t2.list = [1,"2","444",23];

        const str1 = Serialize(t1);
        const str2 = Serialize(t2);

        const t1_copy = Deserialize<Test9b>(str1);
        const t2_copy = Deserialize<Test9>(str2);

        expect(t1_copy.list).toEqual(t1.list);
        expect(t1_copy.name).toEqual(t1.name);

        expect(t2_copy.list).toEqual(t2.list);
    });
    test("10 – Reference to Serializable Constructor", () => {
        @serializable("Test10")
        class Test10 {
            cons: new (s: string) => Test10b;

            newThing(): Test10b {
                return new this.cons("asd");
            }
        }

        @serializable("Test10b")
        class Test10b {
            s: string;
            constructor(s?: string) {
                this.s = s;
            }
        }

        const t = new Test10();
        t.cons = Test10b;

        const str = Serialize(t);
        const t_copy = Deserialize<Test10>(str);

        expect(t_copy.cons).not.toBeUndefined();
        expect(t_copy.newThing()).toBeInstanceOf(Test10b);
        expect(t_copy.newThing().s).toEqual("asd");
    });
    test("11 – Generic class", () => {
        @serializable("Test11")
        class Test11<T> {
            thing: T;
        }

        const t1 = new Test11<string>();
        t1.thing = "asd";

        const t2 = new Test11<number>();
        t2.thing = 5;

        const str1 = Serialize(t1);
        const str2 = Serialize(t2);

        const t1_copy = Deserialize<Test11<string>>(str1);
        const t2_copy = Deserialize<Test11<number>>(str2);

        expect(t1_copy.thing).toEqual(t1.thing);
        expect(t2_copy.thing).toEqual(t2.thing);
    });
    test("12 – 2 Custom classes", () => {
        class Test12 {
            @serialize
            str: string;

            parentThing(): void {}
        }

        @serializable("Test12a")
        class Test12a extends Test12 {
            @serialize
            isOn: boolean;
        }

        @serializable("Test12b")
        class Test12b extends Test12 {
            @serialize
            on: string;

            isOn(): string {
                return "am i on? doubt it! " + this.on;
            }
        }

        const ta = new Test12a();
        ta.str = "TA";
        ta.isOn = true;

        const tb = new Test12b();
        tb.str = "TB";
        tb.on = "ghahahah";

        const t = new Test12();
        t.str = "T";

        const str1 = Serialize(ta);
        const str2 = Serialize(tb);

        const ta_copy = Deserialize<Test12a>(str1);
        const tb_copy = Deserialize<Test12b>(str2);

        expect(ta_copy.str).toEqual(ta.str);
        expect(ta_copy.isOn).toEqual(ta.isOn);
        expect(tb_copy.str).toEqual(tb.str);
        expect(tb_copy.on).toEqual(tb.on);
        expect(tb_copy.isOn()).toEqual(tb.isOn());
    });
    test("13 – Custom class Create from Tag", () => {
        @serializable("Test13")
        class Test13 {
            @serialize
            str: string;

            doThing(): string {
                return "Hi " + this.str;
            }
        }

        const t = Create<Test13>("Test13");
        t.str = "asd";

        expect(t).toBeInstanceOf(Test13);
        expect(t.doThing()).toEqual("Hi asd");
    });
    test("14 – Number", () => {
        const num = Deserialize<number>(Serialize(5));

        expect(num).toBe(5);
    });
    test("15 – Array w/ itself in it", () => {
        const arr: any[] = [1,2];
        arr.push(arr);

        const arr_copy = Deserialize<any[]>(Serialize(arr));

        expect(arr_copy).toHaveLength(3);
        expect(arr_copy[0]).toEqual(arr[0]);
        expect(arr_copy[1]).toEqual(arr[1]);
        expect(arr_copy[2]).toBe(arr_copy);
    });
    test("16 – Date", () => {
        const date = new Date();

        const date2 = Deserialize<Date>(Serialize(date));

        expect(date.getTime()).toEqual(date2.getTime());
    });
    test("17 – Custom Serialization Key Filter", () => {
        class DontSerializeMe {
            info: string;
        }

        @serializable("Test17")
        class SerializeMeButNotOther {
            other: DontSerializeMe;

            data: string;
        }

        const d = new DontSerializeMe();
        d.info = "my info 1";

        const s = new SerializeMeButNotOther();
        s.other = d;
        s.data = "my info 2";

        // Specify custom serialization in Serialization function call
        const s2 = Deserialize<SerializeMeButNotOther>(Serialize(s, [
            {
                type: SerializeMeButNotOther,
                customBehavior: {
                    customKeyFilter: (_: SerializeMeButNotOther, key: string) => {
                        return (key != "other"); // Dont serialize 'other' key
                    }
                }
            }
        ]));

        expect(s2.other).toBeUndefined();
        expect(s2.data).toEqual(s.data);
    });
    test("18 – Custom Serialization Advanced", () => {
        type AnimalType = "Land" | "Aquatic";

        @serializable("Test18")
        class Animal {
            private tag: string;
            private type: AnimalType;

            public constructor(tag: string = "", type: AnimalType = "Land") {
                this.tag = tag;
                this.type = type;
            }

            public getTag(): string {
                return this.tag;
            }
            public getType(): AnimalType {
                return this.type;
            }
        }

        @serializable("Test18b")
        class Zoo {
            private animals: Animal[];

            public constructor(animals: Animal[] = []) {
                this.animals = animals;
            }

            public getAnimals(): Animal[] {
                return this.animals;
            }
        }

        const zoo = new Zoo([
            new Animal("Pig"),
            new Animal("Cow"),
            new Animal("Whale", "Aquatic"),
            new Animal("Leopard"),
            new Animal("Fish", "Aquatic")
        ]);


        // Serialize zoo but only include Land animals
        //  in the list of animals within the zoo
        const s = Serialize(zoo, [
            {
                type: Zoo,
                customBehavior: {
                    customSerialization: (serializer, zoo: Zoo) => {
                        // Perform default serialization
                        const data = serializer.defaultSerialization(zoo);

                        // Now, let's remove all the non-land animals from the 'default'
                        //  Serialization of 'zoo.animals'
                        const animals = zoo.getAnimals().filter((a) => a.getType() == "Land");

                        // Overwrite the data's 'animals' attribute with the new filtered set
                        data["animals"] = serializer.serializeProperty(animals);

                        return data;
                    },
                    customKeyFilter: (_: Zoo, key: string) => {
                        return (key != "animals"); // Don't serialize the animals, let ^ do it
                    }
                }
            }
        ]);
        const landZoo = Deserialize<Zoo>(s);

        expect(landZoo.getAnimals()).toHaveLength(3);
        expect(landZoo.getAnimals()[0].getTag()).toEqual("Pig");
        expect(landZoo.getAnimals()[1].getTag()).toEqual("Cow");
        expect(landZoo.getAnimals()[2].getTag()).toEqual("Leopard");
    });
    test("19 – Serialize certain properties", () => {
        @serializable("Test19")
        class Test19 {
            @serialize
            public prop1: string;

            public prop2: string;

            @serialize(true) // should be same as just @serialize
            public prop3: string;

            public constructor(prop1?: string, prop2: string = "default 2", prop3?: string) {
                this.prop1 = prop1;
                this.prop2 = prop2;
                this.prop3 = prop3;
            }
        }

        const test19 = new Test19("1", "2", "3");

        const test192 = Deserialize<Test19>(Serialize(test19));

        expect(test192.prop1).toEqual(test19.prop1);
        expect(test192.prop2).not.toEqual(test19.prop2);
        expect(test192.prop2).toEqual("default 2");
        expect(test192.prop3).toEqual(test19.prop3);
    });
    test("20 – Don't Serialize certain properties", () => {
        @serializable("Test20")
        class Test20 {
            public prop1: string;
            @serialize(false)
            public prop2: string;
            public prop3: string;

            public constructor(prop1?: string, prop2: string = "default 2", prop3?: string) {
                this.prop1 = prop1;
                this.prop2 = prop2;
                this.prop3 = prop3;
            }
        }

        const test20 = new Test20("1", "2", "3");

        const test202 = Deserialize<Test20>(Serialize(test20));

        expect(test202.prop1).toEqual(test20.prop1);
        expect(test202.prop2).not.toEqual(test20.prop2);
        expect(test202.prop2).toEqual("default 2");
        expect(test202.prop3).toEqual(test20.prop3);
    });
    test("21 – Mix between serializing and not certain properties", () => {
        @serializable("Test21")
        class Test21 {
            @serialize(true)
            public prop1: string;
            @serialize(false)
            public prop2: string;
            @serialize
            public prop3: string;
            public prop4: string;

            public constructor(prop1?: string, prop2: string = "default 2", prop3?: string, prop4: string = "default 4") {
                this.prop1 = prop1;
                this.prop2 = prop2;
                this.prop3 = prop3;
                this.prop4 = prop4;
            }
        }

        const test21 = new Test21("1", "2", "3", "4");

        const test212 = Deserialize<Test21>(Serialize(test21));

        expect(test212.prop1).toEqual(test21.prop1);
        expect(test212.prop2).not.toEqual(test21.prop2);
        expect(test212.prop2).toEqual("default 2");
        expect(test212.prop3).toEqual(test21.prop3);
        expect(test212.prop4).not.toEqual(test21.prop4);
        expect(test212.prop4).toEqual("default 4");
    });
    test("22 – Add Custom Behavior", () => {
        @serializable("Test22", {
            customDeserialization: (_, obj: Test22) => {
                obj.a = "asd";
                obj.b = "fgh";
            }
        })
        class Test22 {
            public a: string;
            public b: string;
            public constructor(a: string = "", b: string = "") {
                this.a = a;
                this.b = b;
            }
        }

        const tt1 = new Test22("aa", "bb");
        const tt1_copy = Deserialize<Test22>(Serialize(tt1));
        expect(tt1_copy.a).toEqual("asd");
        expect(tt1_copy.b).toEqual("fgh");

        addCustomBehavior("Test22", {
            customDeserialization: (_, obj: Test22, data) => {
                obj.a = data["a"];
                obj.b = data["b"];
            },
            customSerialization: (_, obj: Test22) => {
                return {
                    a: obj.a + "22",
                    b: obj.b
                }
            }
        });

        const tt1_copy2 = Deserialize<Test22>(Serialize(tt1));
        expect(tt1_copy2.a).toEqual("aa22");
        expect(tt1_copy2.b).toEqual("bb");
    });
    test("23 – Class with edge-case variable names", () => {
        @serializable("Test23")
        class Test23 {
            uuid: number;
            type: string;
            data: string;

            public constructor(uuid: number = 0, type: string = "", data: string = "") {
                this.uuid = uuid;
                this.type = type;
                this.data = data;
            }
        }

        const t = new Test23(123, "testtt", "dataaa");
        const t2 = Deserialize<Test23>(Serialize(t));

        expect(t2.uuid).toEqual(t.uuid);
        expect(t2.type).toEqual(t.type);
        expect(t2.data).toEqual(t.data);
    });
    test("24 – Compressed serialization", () => {
        const t = new Transform(new Vector(5, 5), new Vector(10, 8), 45);

        const str = Serialize(t);
        const json = JSON.parse(str);

        expect(json).toEqual({
            "0": {
                type: "Transform",
                data: {
                    pos: { type: "Vector", data: { x: 5, y: 5 } },
                    size: { type: "Vector", data: { x: 10, y: 8 } },
                    rotation: 45
                }
            }
        });

        const t_copy = Deserialize<Transform>(str);
        expect(t).toEqual(t_copy);
    });
    test("25 – Multi-layer compressed serialization", () => {
        @serializable("Test25Thing")
        class Thing {
            transform: Transform;

            public constructor(transform: Transform = new Transform()) {
                this.transform = transform;
            }
        }

        const t = new Thing(new Transform(new Vector(5, 5), new Vector(10, 8), 45));

        const str = Serialize(t);
        const json = JSON.parse(str);

        expect(json).toEqual({
            "0": {
                type: "Test25Thing",
                data: {
                    transform: {
                        type: "Transform",
                        data: {
                            pos: { type: "Vector", data: { x: 5, y: 5 } },
                            size: { type: "Vector", data: { x: 10, y: 8 } },
                            rotation: 45
                        }
                    }
                }
            }
        });

        const t_copy = Deserialize<Thing>(str);
        expect(t).toEqual(t_copy);
    });
    test("26 – Compressed array", () => {
        const v = new Vector(7, 7);
        const arr = [new Vector(5, 5), v, new Transform(new Vector(1, 2), v, 30), v];

        const str = Serialize(arr);
        const json = JSON.parse(str);

        expect(json).toEqual({
            "0": {
                type: "Array",
                data: [
                    { type: "Vector", data: { x: 5, y: 5 } },
                    { ref: "2" },
                    {
                        type: "Transform",
                        data: {
                            pos: { type: "Vector", data: { x: 1, y: 2 }},
                            size: { ref: "2" },
                            rotation: 30
                        }
                    },
                    { ref: "2" }
                ]
            },
            "2": { type: "Vector", data: { x: 7, y: 7 } }
        });

        const arr_copy = Deserialize<any[]>(str);
        expect(arr).toEqual(arr_copy);
    });
    test("27 – Undefined", () => {
        @serializable("Test27")
        class Test27 {
            thing: any;
            num: number;

            public constructor(thing?: any, num: number = 0) {
                this.thing = thing;
                this.num = num;
            }
        }

        const t = new Test27(undefined, 37);

        const t_copy = Deserialize<Test27>(Serialize(t));

        expect(t).toEqual(t_copy);
    });
});