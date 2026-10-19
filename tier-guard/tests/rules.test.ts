import { expect, test } from 'claude-code/testing'

import { familyOf, isLowEffortTaskWorker, spawnWarning, switchNote } from '../hooks/rules.ts'

test('family comes from aliases and full ids', () => {
  expect(familyOf('claude-opus-5-5')).toBe('opus')
  expect(familyOf('haiku')).toBe('haiku')
  expect(familyOf(undefined)).toBe('')
})

test('Explore on an expensive model and a tier mismatch warn; the right tier does not', () => {
  expect(spawnWarning('Explore', 'claude-fable-5-1')).toMatch(/task-worker/)
  expect(spawnWarning('Explore', 'claude-haiku-5-5')).toBe('')
  expect(spawnWarning('default-worker', 'claude-opus-5-5')).toMatch(/sonnet/)
  expect(spawnWarning('task-worker', 'claude-haiku-5-5')).toBe('')
  expect(spawnWarning('general-purpose', 'claude-opus-5-5')).toBe('')
})

test('only task-worker on low effort is flagged', () => {
  expect(isLowEffortTaskWorker('task-worker', 'low')).toBe(true)
  expect(isLowEffortTaskWorker('task-worker', 'medium')).toBe(false)
  expect(isLowEffortTaskWorker('default-worker', 'low')).toBe(false)
})

test('switch note names what changed', () => {
  expect(switchNote(null, { model: 'a' })).toBe('')
  expect(switchNote({ model: 'a', effort: 'high' }, { model: 'a', effort: 'high' })).toBe('')
  expect(switchNote({ model: 'a', effort: 'high' }, { model: 'b', effort: 'low' })).toBe('모델 a→b, effort high→low')
})
