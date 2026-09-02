declare module 'astro:content' {
	interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"dreams": {
"airplane.md": {
	id: "airplane.md";
  slug: "airplane";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"angel.md": {
	id: "angel.md";
  slug: "angel";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"baby.md": {
	id: "baby.md";
  slug: "baby";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"bear.md": {
	id: "bear.md";
  slug: "bear";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"bees.md": {
	id: "bees.md";
  slug: "bees";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"being-betrayed-by-a-friend.md": {
	id: "being-betrayed-by-a-friend.md";
  slug: "being-betrayed-by-a-friend";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"being-chased.md": {
	id: "being-chased.md";
  slug: "being-chased";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"being-late.md": {
	id: "being-late.md";
  slug: "being-late";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"bird.md": {
	id: "bird.md";
  slug: "bird";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"blood.md": {
	id: "blood.md";
  slug: "blood";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"bridge.md": {
	id: "bridge.md";
  slug: "bridge";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"butterfly.md": {
	id: "butterfly.md";
  slug: "butterfly";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"car-accident.md": {
	id: "car-accident.md";
  slug: "car-accident";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"cat.md": {
	id: "cat.md";
  slug: "cat";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"cave.md": {
	id: "cave.md";
  slug: "cave";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"celebrity.md": {
	id: "celebrity.md";
  slug: "celebrity";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"cheating-partner.md": {
	id: "cheating-partner.md";
  slug: "cheating-partner";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"cockroach.md": {
	id: "cockroach.md";
  slug: "cockroach";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"death.md": {
	id: "death.md";
  slug: "death";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"demon.md": {
	id: "demon.md";
  slug: "demon";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"desert.md": {
	id: "desert.md";
  slug: "desert";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"dog.md": {
	id: "dog.md";
  slug: "dog";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"drowning.md": {
	id: "drowning.md";
  slug: "drowning";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"earthquake.md": {
	id: "earthquake.md";
  slug: "earthquake";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"elevator.md": {
	id: "elevator.md";
  slug: "elevator";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"ex.md": {
	id: "ex.md";
  slug: "ex";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"falling.md": {
	id: "falling.md";
  slug: "falling";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"fire.md": {
	id: "fire.md";
  slug: "fire";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"fish.md": {
	id: "fish.md";
  slug: "fish";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"flood.md": {
	id: "flood.md";
  slug: "flood";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"flying.md": {
	id: "flying.md";
  slug: "flying";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"forest.md": {
	id: "forest.md";
  slug: "forest";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"ghost.md": {
	id: "ghost.md";
  slug: "ghost";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"giving-birth.md": {
	id: "giving-birth.md";
  slug: "giving-birth";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"hair-falling-out.md": {
	id: "hair-falling-out.md";
  slug: "hair-falling-out";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"horse.md": {
	id: "horse.md";
  slug: "horse";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"house.md": {
	id: "house.md";
  slug: "house";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"island.md": {
	id: "island.md";
  slug: "island";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"king-or-queen.md": {
	id: "king-or-queen.md";
  slug: "king-or-queen";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"kissing.md": {
	id: "kissing.md";
  slug: "kissing";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"lion.md": {
	id: "lion.md";
  slug: "lion";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"losing-a-job.md": {
	id: "losing-a-job.md";
  slug: "losing-a-job";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"losing-a-phone.md": {
	id: "losing-a-phone.md";
  slug: "losing-a-phone";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"losing-a-wallet.md": {
	id: "losing-a-wallet.md";
  slug: "losing-a-wallet";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"maze.md": {
	id: "maze.md";
  slug: "maze";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"mirror.md": {
	id: "mirror.md";
  slug: "mirror";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"missing-a-flight.md": {
	id: "missing-a-flight.md";
  slug: "missing-a-flight";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"money.md": {
	id: "money.md";
  slug: "money";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"monster.md": {
	id: "monster.md";
  slug: "monster";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"moon.md": {
	id: "moon.md";
  slug: "moon";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"mountain.md": {
	id: "mountain.md";
  slug: "mountain";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"naked-in-public.md": {
	id: "naked-in-public.md";
  slug: "naked-in-public";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"ocean.md": {
	id: "ocean.md";
  slug: "ocean";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"pregnancy.md": {
	id: "pregnancy.md";
  slug: "pregnancy";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"prison.md": {
	id: "prison.md";
  slug: "prison";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"quicksand.md": {
	id: "quicksand.md";
  slug: "quicksand";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"rain.md": {
	id: "rain.md";
  slug: "rain";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"rainbow.md": {
	id: "rainbow.md";
  slug: "rainbow";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"running-but-not-moving.md": {
	id: "running-but-not-moving.md";
  slug: "running-but-not-moving";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"school.md": {
	id: "school.md";
  slug: "school";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"shark.md": {
	id: "shark.md";
  slug: "shark";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"shoes.md": {
	id: "shoes.md";
  slug: "shoes";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"sleep-paralysis.md": {
	id: "sleep-paralysis.md";
  slug: "sleep-paralysis";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"snake.md": {
	id: "snake.md";
  slug: "snake";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"spider-web.md": {
	id: "spider-web.md";
  slug: "spider-web";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"spider.md": {
	id: "spider.md";
  slug: "spider";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"storm.md": {
	id: "storm.md";
  slug: "storm";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"stranger.md": {
	id: "stranger.md";
  slug: "stranger";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"taking-an-exam.md": {
	id: "taking-an-exam.md";
  slug: "taking-an-exam";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"teeth-falling-out.md": {
	id: "teeth-falling-out.md";
  slug: "teeth-falling-out";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"tiger.md": {
	id: "tiger.md";
  slug: "tiger";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"tornado.md": {
	id: "tornado.md";
  slug: "tornado";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"tsunami.md": {
	id: "tsunami.md";
  slug: "tsunami";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"twins.md": {
	id: "twins.md";
  slug: "twins";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"volcano.md": {
	id: "volcano.md";
  slug: "volcano";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"water.md": {
	id: "water.md";
  slug: "water";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"wedding.md": {
	id: "wedding.md";
  slug: "wedding";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"wolf.md": {
	id: "wolf.md";
  slug: "wolf";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
"zombie.md": {
	id: "zombie.md";
  slug: "zombie";
  body: string;
  collection: "dreams";
  data: any
} & { render(): Render[".md"] };
};
"guides": {
"difference-between-a-dream-a-nightmare-and-a-night-terror.md": {
	id: "difference-between-a-dream-a-nightmare-and-a-night-terror.md";
  slug: "difference-between-a-dream-a-nightmare-and-a-night-terror";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"false-awakenings-why-they-happen.md": {
	id: "false-awakenings-why-they-happen.md";
  slug: "false-awakenings-why-they-happen";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"how-to-improve-dream-recall.md": {
	id: "how-to-improve-dream-recall.md";
  slug: "how-to-improve-dream-recall";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"how-to-lucid-dream.md": {
	id: "how-to-lucid-dream.md";
  slug: "how-to-lucid-dream";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"how-to-recognize-dream-signs.md": {
	id: "how-to-recognize-dream-signs.md";
  slug: "how-to-recognize-dream-signs";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"reality-checks-for-lucid-dreaming-which-ones-work.md": {
	id: "reality-checks-for-lucid-dreaming-which-ones-work.md";
  slug: "reality-checks-for-lucid-dreaming-which-ones-work";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"wake-back-to-bed-wbtb-technique.md": {
	id: "wake-back-to-bed-wbtb-technique.md";
  slug: "wake-back-to-bed-wbtb-technique";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"what-causes-recurring-dreams-and-nightmares.md": {
	id: "what-causes-recurring-dreams-and-nightmares.md";
  slug: "what-causes-recurring-dreams-and-nightmares";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"what-is-sleep-paralysis-causes-and-symptoms.md": {
	id: "what-is-sleep-paralysis-causes-and-symptoms.md";
  slug: "what-is-sleep-paralysis-causes-and-symptoms";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
"why-do-we-dream-the-science-behind-dreaming.md": {
	id: "why-do-we-dream-the-science-behind-dreaming.md";
  slug: "why-do-we-dream-the-science-behind-dreaming";
  body: string;
  collection: "guides";
  data: any
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = never;
}
