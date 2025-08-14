/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    core.getInput.mockImplementation(() => '')
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('run', () => {
    it('should fail if no token is provided', async () => {
      await run()
      expect(core.setFailed).toHaveBeenCalledWith(
        'GITHUB_TOKEN (or GH_TOKEN) is required via workflow `with: github-token` or env `secrets.GITHUB_TOKEN`.'
      )
    })
  })
})
