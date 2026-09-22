import { effectScope, markRaw, reactive } from "vue";
import { dispose } from "@tresjs/core";
import { Object3D } from "three";

//#region src/core/entity.ts
const createEntity = (engine, object) => {
	const scope = effectScope();
	const entity = reactive({
		add: (child) => {
			child.removeFromParent();
			child.parent = entity;
			entity.children.push(child);
		},
		addComponent: (name, setup) => {
			if (entity.component[name]) return;
			const component = scope.run(() => {
				const event = { dispose: /* @__PURE__ */ new Set() };
				const hook = { onDispose: (callback) => {
					event.dispose.add(callback);
				} };
				const value = setup(hook);
				const preset = {
					__event: event,
					__hook: hook
				};
				return reactive(Object.assign(value, preset));
			});
			if (!component) throw new Error(`Component ${String(name)} setup returned undefined`);
			entity.component[name] = component;
		},
		children: [],
		component: {},
		dispose: () => {
			entity.traverse((e) => {
				Object.values(e.component).forEach((component) => {
					component.__event.dispose.forEach((callback) => callback());
					component.__event.dispose.clear();
					component.value = null;
				});
				e.component = {};
				dispose(e.ref);
				engine.entityManager.delete(e);
			});
		},
		getComponent: (name) => {
			return entity.component[name];
		},
		parent: null,
		query: (name) => {
			const stack = [entity];
			while (stack.length) {
				const current = stack.pop();
				if (!current) continue;
				if (current.ref.name === name) return current;
				const children = current.children;
				if (children && children.length) for (let i = children.length - 1; i >= 0; i--) {
					const child = children[i];
					if (!child) continue;
					stack.push(child);
				}
			}
			return null;
		},
		ref: markRaw(object),
		remove: (child) => {
			const index = entity.children.indexOf(child);
			child.parent = null;
			entity.children.splice(index, 1);
		},
		removeFromParent: () => {
			if (entity.parent) entity.parent.remove(entity);
		},
		traverse: (callback) => {
			const stack = [entity];
			while (stack.length) {
				const current = stack.pop();
				if (!current) continue;
				callback(current);
				const children = current.children;
				if (children && children.length) for (let i = children.length - 1; i >= 0; i--) {
					const child = children[i];
					if (!child) continue;
					stack.push(child);
				}
			}
		}
	});
	engine.entityManager.add(entity);
	return entity;
};

//#endregion
export { createEntity };