# Serialeazy

[![npm][npm]][npm-url]
[![deps][deps]][deps-url]
[![Install Size][size]][size-url]
[![Downloads][downloads]][downloads-url]

Serialeazy is a utility library that can serialize complex model-graphs and deserialize them with all references and type information intact.


_Serialize and deserialize arbitrarily complex objects into JSON_

_Serialeazy is feature complete and supports serialization of references, type information, generics, inheritance, function types, and much much more._

# Features

-   (De)serialize primitive values
-   (De)serialize any object (tagged as serializable) and have it saved as a reference
-   (De)serialize nested objects, maps, sets and arrays (more coming soon)
-   Supports inheritance
-   Supports generics
-   Support type information
-   Works on any ES5 environment (if ES3 is needed file a feature request)
-   Convenience decorators for ESNext / Typescript
-   Ships with typescript
-   Generic solution that works well with any arbitrary data structure

# Installation

```console
$ npm install serialeazy --save
```

# Quick example:

```typescript
import {serialize, serializable, Serialize, Deserialize} from 'serialeazy';

// Example model classes
@serializable("Animal")
class Animal {
    @serialize
    private name: string;

    public constructor(name: string) {
        this.name = name;
    }

    public getName(): string {
        return this.name;
    }
}

@serializable("Zoo")
class Zoo {
    @serialize
    private animals: Animal[];

    public constructor() {
        this.animals = [];
    }

    public addAnimal(animal: Animal): void {
        this.animals.push(animal);
    }

    public listAnimals(): void {
        console.log("Animals in the zoo: ");
        for (const animal of this.animals)
            console.log("\t" + animal.getName());
    }

    public getAnimals(): Animal[] {
        return this.animals;
    }
}


const zoo = new Zoo();
zoo.addAnimal(new Animal("Giraffe"));
zoo.addAnimal(new Animal("Lion"));
zoo.addAnimal(new Animal("Wombat"));


const json = Serialize(zoo); // serialize into string

const zoo_copy = Deserialize<Zoo>(json); // deserialize back into Zoo

zoo_copy.listAnimals();
console.log(zoo_copy instanceof Zoo);
console.log(zoo_copy.getAnimals().every(animal => animal instanceof Animal));
```

## Output:

```
Animals in the zoo
    Giraffe
    Lion
    Wombat
true
true
```

# Enabling decorators

**TypeScript**

Enable the compiler option `experimentalDecorators` in `tsconfig.json` or pass it as flag `--experimentalDecorators` to the compiler. Also make sure to enable the `emitDecoratorMetadata` flag.

# More Examples

## 1. Basic serialization

```typescript
@serializable("Person")
class Person {
    /* by default, all properties are automatically marked as '@serialize' so it can be omitted */
    public name: string;
    public age: number;
    public height: string;

    public constructor(name: string, age: number, height: string) {
        this.name = name;
        this.age = age;
        this.height = height;
    }
}

const p1 = new Person("Leon", "20", "6' 1");

const p1_copy = Deserialize<Person>(Serialize(p1));

console.log(p1.name   == p1_copy.name);   // true
console.log(p1.age    == p1_copy.age);    // true
console.log(p1.height == p1_copy.height); // true
console.log(p1_copy instanceof Person);   // true
```

## 2. References

```typescript
@serializable("Person")
class Person {
    /* by default, all properties are automatically marked as '@serialize' so it can be omitted */
    public name: string;
    public age: number;
    public height: string;

    public constructor(name: string, age: number, height: string) {
        this.name = name;
        this.age = age;
        this.height = height;
    }
}

const p1 = new Person("Leon", "20", "6' 1");
const p2 = new Person("Tash", "20", "5' 1");
const p3 = new Perons("Daniel", "21", "6' 0");

const people = [p1, p2, p3, p1, p2, p3];

const people_copy = Deserialize<Person[]>(Serialize(people));

console.log(people_copy.length); // 6
console.log(people_copy[0] === people_copy[3]); // true
console.log(people_copy[1] === people_copy[4]); // true
console.log(people_copy[2] === people_copy[5]); // true
```

* * *

[deps]: https://david-dm.org/LeonMontealegre/serialeazy/status.svg
[deps-url]: https://david-dm.org/LeonMontealegre/serialeazy

[downloads]: https://img.shields.io/npm/dt/serialeazy
[downloads-url]: https://www.npmjs.com/package/serialeazy

[npm]: https://img.shields.io/npm/v/serialeazy
[npm-url]: https://www.npmjs.com/package/serialeazy

[size]: https://packagephobia.com/badge?p=serialeazy
[size-url]: https://packagephobia.com/result?p=serialeazy

