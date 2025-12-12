// Basic tests for the Resume Auto Apply Agent

const assert = require('assert');

describe('Platform Detection', () => {
  const { getPlatformConfig, mapQuestionToField } = require('../server/config/platforms');

  it('should detect Lever platform', () => {
    const result = getPlatformConfig('https://jobs.lever.co/ekimetrics/d9d64766-3d42-4ba9-94d4-f74cdaf20065');
    assert.strictEqual(result.platform, 'lever');
    assert.ok(result.config);
  });

  it('should detect Greenhouse platform', () => {
    const result = getPlatformConfig('https://boards.greenhouse.io/company/jobs/123456');
    assert.strictEqual(result.platform, 'greenhouse');
  });

  it('should detect Workday platform', () => {
    const result = getPlatformConfig('https://company.wd5.myworkdayjobs.com/External');
    assert.strictEqual(result.platform, 'workday');
  });

  it('should return unknown for unsupported platforms', () => {
    const result = getPlatformConfig('https://randomsite.com/careers');
    assert.strictEqual(result.platform, 'unknown');
  });
});

describe('Question Mapping', () => {
  const { mapQuestionToField } = require('../server/config/platforms');

  it('should map work authorization questions', () => {
    assert.strictEqual(mapQuestionToField('Are you authorized to work in the US?'), 'workAuthorized');
    assert.strictEqual(mapQuestionToField('Are you legally authorized to work?'), 'workAuthorized');
  });

  it('should map sponsorship questions', () => {
    assert.strictEqual(mapQuestionToField('Do you require visa sponsorship?'), 'requiresSponsorship');
    assert.strictEqual(mapQuestionToField('Will you now or in the future require sponsorship?'), 'requiresSponsorship');
  });

  it('should map experience questions', () => {
    assert.strictEqual(mapQuestionToField('How many years of experience do you have?'), 'yearsExperience');
  });

  it('should return null for unknown questions', () => {
    assert.strictEqual(mapQuestionToField('What is your favorite color?'), null);
  });
});

describe('CAPTCHA Solver', () => {
  const CaptchaSolver = require('../server/utils/captchaSolver');
  const solver = new CaptchaSolver();

  it('should initialize without errors', () => {
    assert.ok(solver);
  });

  it('should return null for unknown captcha type', async () => {
    const result = await solver.solve({ type: 'unknown', siteKey: 'test', pageUrl: 'http://test.com' });
    assert.strictEqual(result, null);
  });
});

describe('Logger', () => {
  const { logger } = require('../server/utils/logger');

  it('should have required logging methods', () => {
    assert.ok(typeof logger.info === 'function');
    assert.ok(typeof logger.error === 'function');
    assert.ok(typeof logger.warn === 'function');
  });
});

// Run tests
if (require.main === module) {
  console.log('Running tests...\n');
  
  const tests = [
    'Platform Detection',
    'Question Mapping',
    'CAPTCHA Solver',
    'Logger'
  ];
  
  let passed = 0;
  let failed = 0;
  
  // Simple test runner
  console.log('Note: This is a basic test file. For full testing, use: npm test');
}
