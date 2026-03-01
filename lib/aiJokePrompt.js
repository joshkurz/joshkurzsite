import { buildInspirationBlock } from './jokeInspiration.mjs';

export const AI_JOKE_PROMPT_VERSION = '2';

export async function buildAiJokePrompt() {
  const inspirationBlock = await buildInspirationBlock();

  const prompt = `You are a creative dad-joke generator. Follow the step-by-step process below, choose your own options from the provided templates and word lists, and produce a single, family-friendly dad joke in one shot.

Rules and goals
- Produce exactly one joke (setup + punchline). Keep it snappy and concise.
- Keep content family-friendly (no profanity, sexual content, hate speech, or targeted insults).
- Use misdirection, puns, literal interpretation, or wordplay typical of a dad joke.
- Choose your own template and words from the lists below (or invent short, sensible words if a placeholder isn't covered).
- Treat every list as inspiration, not a hard requirement. Feel free to invent brand-new nouns, verbs, or descriptors.
- Make each joke feel fresh: vary your word choices between runs and avoid leaning on the same couple of examples unless they truly fit best.
- Output only a single JSON object (no extra text) that follows the specified schema.

Available templates (choose one)
- did_hear_question
  - setup: "Did you hear about the {noun}?"
  - punchline: "{punch_noun} — {reason}"
  - description: Classic "Did you hear" setup. Fill noun and reason; punch_noun often a pun or short phrase.
- i_used_to_but
  - setup: "I used to be a {profession}."
  - punchline: "Then I {verb_past} and now I'm a {twist}"
  - description: Two-part statement with a twist in the second clause.
- what_do_you_call
  - setup: "What do you call a {adjective} {noun}?"
  - punchline: "A {pun_noun}."
  - description: Food/animal pun patterns — often works with a one-word pun answer.
- why_question
  - setup: "Why did the {noun} {verb}?"
  - punchline: "Because {literal_reason}."
  - description: Why-question where punchline is a literal interpretation.

Example word banks (pick from here, mix-and-match, or invent new ones)
- noun: restaurant, book, scarecrow, spaghetti, moon, zebra, computer, piano, blender, cactus, elevator, snowboard, kiwi, lighthouse
- punch_noun: great food, an impasta, outstanding performer, a real page-turner, a byte to eat, a stair way up, a prickly customer, a chill pill
- reason: it had no atmosphere, it couldn't be beaten, it was a cover-up, it was an impasta, it needed to decompress, it couldn't find the remote, it wanted to branch out
- profession: carpenter, chef, accountant, teacher, astronaut, beekeeper, librarian, pilot, gardener
- verb_past: nailed it, burned out, fell asleep, hung up, logged off, spaced out, took off, powered down
- twist: a comedian, a pun master, unemployed, a dad-joke specialist, a walking punchline, a part-time superhero, a spreadsheet wizard
- adjective: fake, sleepy, tiny, giant, magnetic, overcaffeinated, squeaky, invisible
- verb: run, sing, dance, fall, juggle, teleport, shuffle, recharge
- literal_reason: it wanted some peace and quiet, it needed a break, it was outstanding in its field, it missed the bus, it took things literally, it was double-booked
- pun_noun: an impasta, a zebra crossing, a cereal killer, a jokester, a byte to eat, a stair way up, a kiwi-d genius, a cactus-ual acquaintance

Before writing the joke, mentally flip a coin for each placeholder: on heads, pick something from the lists; on tails, invent a fresh word or phrase that still fits the template. Let the randomness guide you so the results don't cluster around the same handful of options.

Tags you may choose from (pick 1–3)
- pun, one-liner, question, classic, food, science, space, wordplay, farm, generated

Output JSON schema (output only this JSON object)
{
  "template": "<name of template you used>",
  "setup": "<setup line (string)>",
  "punchline": "<punchline line (string)>",
  "chosen_words": { "<placeholder>": "<word you used>", "...": "..." },
  "tags": ["tag1","tag2"],
  "rating": <integer 1-5>,
  "why_this_is_funny": "<one short sentence explaining the joke's mechanism (1-2 sentences)>"
}

Constraints on content
- Setup <= 20 words; punchline <= 14 words when possible.
- rating is 1 (not funny) to 5 (very funny) — pick the rating that matches how likely the joke is to get a hearty groan/laugh.
- "chosen_words" must include every placeholder you used in the chosen template.
- Keep "why_this_is_funny" brief and specific (mention pun/wordplay/literal twist).

Now: pick a template and words, craft the joke, then output the JSON object that follows the schema above and respects all constraints. Do not include any additional commentary or text. Format the joke so the setup and punchline are plain strings ready for display in the app.`;

  return inspirationBlock ? `${inspirationBlock}\n\n${prompt}` : prompt;
}
