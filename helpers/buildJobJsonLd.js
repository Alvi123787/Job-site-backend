// backend/helpers/buildJobJsonLd.js
// Produces a JSON-LD string for a JobPosting from a job object.
function isoOrNull(d) {
  try { return d ? new Date(d).toISOString() : null; } catch(e) { return null; }
}

function sanitizeText(t) {
  if (!t) return "";
  // Basic sanitization: strip script tags and excessive whitespace.
  return String(t).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").trim();
}

function numberOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function buildJobJsonLd(job = {}, site = {}) {
  // site: { name, url, logo }
  const minSalary = numberOrNull(job.salaryMin || (job.salary && job.salary.min));
  const maxSalary = numberOrNull(job.salaryMax || (job.salary && job.salary.max));
  const currency = (job.salaryCurrency || (job.salary && job.salary.currency) || "PKR").toUpperCase();
  const unit = (job.salaryUnit || "MONTH").toUpperCase();

  const datePosted = isoOrNull(job.datePosted || job.createdAt || job.postedAt);
  const validThrough = isoOrNull(job.validThrough || (job.datePosted ? (new Date(job.datePosted).getTime() + 30*24*60*60*1000) : null));

  const json = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": sanitizeText(job.title || job.role || ""),
    "description": sanitizeText(job.description || ""),
    "identifier": {
      "@type": "PropertyValue",
      "name": site.name || (job.company && job.company.name) || "",
      "value": String(job._id || job.id || job.slug || "")
    },
    "datePosted": datePosted,
    "validThrough": validThrough,
    "employmentType": (job.employmentType || "FULL_TIME"),
    "hiringOrganization": {
      "@type": "Organization",
      "name": (job.company && job.company.name) || job.companyName || site.name || "",
      "sameAs": (job.company && job.company.url) || job.companyUrl || site.url || undefined,
      "logo": (job.company && job.company.logo) || job.companyLogo || site.logo || undefined
    },
    "jobLocation": job.isRemote ? {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": (job.city || "Remote"),
        "addressCountry": job.country || "PK"
      }
    } : {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": job.streetAddress || "",
        "addressLocality": job.city || "",
        "addressRegion": job.region || "",
        "postalCode": job.postalCode || "",
        "addressCountry": job.country || ""
      }
    },
    "url": (job.canonicalUrl || job.url || `${site.url || ""}/jobs/${job.slug || job._id || job.id || ""}`)
  };

  if (minSalary !== null || maxSalary !== null) {
    json.baseSalary = {
      "@type": "MonetaryAmount",
      "currency": currency,
      "value": {
        "@type": "QuantitativeValue",
        "minValue": (minSalary !== null ? minSalary : (maxSalary !== null ? maxSalary : 0)),
        "maxValue": (maxSalary !== null ? maxSalary : (minSalary !== null ? minSalary : 0)),
        "unitText": unit
      }
    };
  }

  // Remove undefined or null entries
  function clean(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const out = Array.isArray(obj) ? [] : {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) continue;
      out[k] = (typeof v === "object") ? clean(v) : v;
    }
    return out;
  }

  const cleaned = clean(json);
  return JSON.stringify(cleaned);
}

export default buildJobJsonLd;