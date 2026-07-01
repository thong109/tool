function hello() {
  const x = 1;
  return x;
}
const obj = {
  a: 1, b: 2, c: function() {
    return this.a + this.b;
  }
};
if (true) {
  console.log('hello');
} else {
  console.log('world');
}
for (let i = 0; i < 10; i++) {
  console.log(i);
}
const arr = [1, 2, 3, 4, 5].map(x => x * 2).filter(x => x > 5);
class MyClass {
  constructor(name) {
    this.name = name;
  } greet() {
    return `Hello, ${this.name}!`;
  }
}
try {
  throw new Error('test');
} catch (e) {
  console.error(e);
} finally {
  console.log('done');
}
