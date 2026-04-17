import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROMPT_YAML,
  PROMPT_KINDS,
  PROMPT_KIND_META,
  getBuiltinPromptTemplate,
  parsePromptYaml,
  renderTemplate,
  serializePromptYaml,
} from '../src/lib/prompts';

describe('renderTemplate', () => {
  it('replaces {{var}} placeholders', () => {
    expect(renderTemplate('hello {{name}}', { name: 'world' })).toBe('hello world');
  });

  it('replaces missing vars with empty string', () => {
    expect(renderTemplate('a={{a}}, b={{b}}', { a: 'x' })).toBe('a=x, b=');
  });

  it('handles whitespace inside braces', () => {
    expect(renderTemplate('x={{ x }}', { x: '1' })).toBe('x=1');
  });

  it('coerces non-string values', () => {
    expect(renderTemplate('count={{n}}', { n: 42 })).toBe('count=42');
  });

  it('leaves no placeholders when value contains other braces', () => {
    expect(renderTemplate('{{a}}', { a: '{{b}}' })).toBe('{{b}}');
  });
});

describe('parsePromptYaml', () => {
  it('parses a minimal valid YAML', () => {
    const { template } = parsePromptYaml(
      'name: x\nuser: |-\n  hi {{name}}\n',
      'planning.segment',
    );
    expect(template.name).toBe('x');
    expect(template.user).toBe('hi {{name}}');
  });

  it('throws when user field is missing or empty', () => {
    expect(() => parsePromptYaml('name: x\nuser: ""\n', 'planning.segment')).toThrow();
  });

  it('throws on invalid YAML', () => {
    expect(() => parsePromptYaml('::: not yaml', 'planning.segment')).toThrow();
  });
});

describe('serializePromptYaml round-trip', () => {
  it('serializes and re-parses to equivalent template', () => {
    const original = parsePromptYaml(DEFAULT_PROMPT_YAML['planning.segment'], 'planning.segment').template;
    const yamlText = serializePromptYaml(original);
    const reparsed = parsePromptYaml(yamlText, 'planning.segment').template;
    expect(reparsed.name).toBe(original.name);
    expect(reparsed.user).toBe(original.user);
  });
});

describe('PROMPT_KINDS and metadata', () => {
  it('every kind has metadata and a default YAML', () => {
    for (const kind of PROMPT_KINDS) {
      expect(PROMPT_KIND_META[kind]).toBeDefined();
      expect(DEFAULT_PROMPT_YAML[kind]).toBeTruthy();
    }
  });

  it('every default YAML parses cleanly', () => {
    for (const kind of PROMPT_KINDS) {
      const tpl = getBuiltinPromptTemplate(kind);
      expect(tpl.user).toBeTruthy();
    }
  });
});
