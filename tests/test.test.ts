import "jest";
import {inspect} from "util";
import {serialize, serializable, Serialize, Deserialize} from "../src/Serializer";

describe("Test 1", () => {
    test("1", () => {
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
    test("2", () => {
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
    test("3", () => {
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
    test("4", () => {
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

        expect(1).toEqual(1);
    });
    test("5", () => {
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
    test("6", () => {
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
    test("7", () => {
        const str = Serialize([1,2,3,4]);
        const arr = Deserialize<Array<number>>(str);

        expect(arr).toEqual([1,2,3,4]);
    });
    test("8", () => {
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
    test("9", () => {
        @serializable("Test9")
        class Test9 {
            @serialize
            public list: Array<any>;
        }

        @serializable("Test9b")
        class Test9b extends Test9 {
            @serialize
            public list: Array<number>;

            @serialize
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
})