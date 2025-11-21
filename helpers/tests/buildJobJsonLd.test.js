// Simple validator script for buildJobJsonLd
// Run with: npm run test:schema
import buildJobJsonLd from '../buildJobJsonLd.js'

function assert(cond, msg) {
  if (!cond) {
    console.error('Assertion failed:', msg)
    process.exitCode = 1
  }
}

function run() {
  const site = { name: 'TestSite', url: 'https://example.com', logo: 'https://example.com/logo.png' }
  const job = {
    id: '507f191e810c19729de860ea',
    title: 'Senior Backend Engineer',
    description: 'Build APIs and services.',
    employmentType: 'FULL_TIME',
    companyName: 'Acme Corp',
    city: 'Karachi',
    country: 'PK',
    isRemote: false,
    salaryMin: 100000,
    salaryMax: 200000,
    salaryCurrency: 'USD',
    salaryUnit: 'YEAR',
    datePosted: '2025-01-01T00:00:00.000Z',
    validThrough: '2025-12-31T00:00:00.000Z',
  }

  const jsonldStr = buildJobJsonLd(job, site)
  assert(typeof jsonldStr === 'string' && jsonldStr.length > 0, 'Output must be a non-empty string')
  let obj
  try {
    obj = JSON.parse(jsonldStr)
  } catch (e) {
    console.error('Invalid JSON:', e?.message || e)
    process.exit(1)
  }

  assert(obj['@type'] === 'JobPosting', 'JSON-LD must contain @type: JobPosting')
  assert(obj['@context'] === 'https://schema.org', 'JSON-LD must contain @context with schema.org URL')
  assert(obj.title && obj.description, 'title and description must be present')

  // Currency ISO 4217 and default
  const currency = obj?.baseSalary?.currency
  assert(typeof currency === 'string' && currency.length === 3 && currency.toUpperCase() === currency, 'Currency must be ISO 4217 uppercase')

  // UnitText present and uppercase
  const unitText = obj?.baseSalary?.value?.unitText
  assert(typeof unitText === 'string' && unitText.toUpperCase() === unitText, 'unitText should be uppercase like YEAR/MONTH')

  // URL generation
  assert(typeof obj.url === 'string' && obj.url.length > 0, 'url must be present')

  console.log('buildJobJsonLd test passed.')
}

run()