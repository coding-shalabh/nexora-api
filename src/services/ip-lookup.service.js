const axios = require('axios');

const IPAPI_KEY = process.env.IPAPI_KEY || 'a40190664a200f86c6a6';
const IPAPI_BASE_URL = 'https://api.ipapi.is';

/**
 * IP Lookup Service using ipapi.is
 * Provides company/organization info, geolocation, ASN data from IP addresses
 */
class IpLookupService {
  constructor() {
    this.apiKey = IPAPI_KEY;
    this.cache = new Map(); // Simple in-memory cache
    this.cacheTimeout = 60 * 60 * 1000; // 1 hour cache
  }

  /**
   * Look up IP address details
   * @param {string} ip - IP address to look up
   * @returns {Promise<Object>} IP details including company, location, ASN
   */
  async lookup(ip) {
    // Check cache first
    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const url = `${IPAPI_BASE_URL}?q=${ip}&key=${this.apiKey}`;
      const response = await axios.get(url, { timeout: 5000 });

      const data = this.transformResponse(response.data, ip);

      // Cache the result
      this.cache.set(ip, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      console.error('IP Lookup failed:', error.message);
      throw new Error(`Failed to lookup IP: ${error.message}`);
    }
  }

  /**
   * Transform API response to a cleaner format
   */
  transformResponse(apiData, ip) {
    return {
      ip,
      // Company/Organization Info
      company: {
        name: apiData.company?.name || apiData.asn?.org || null,
        domain: apiData.company?.domain || null,
        type: apiData.company?.type || null, // business, isp, hosting, education
      },
      // ASN (Autonomous System Number) Info
      asn: {
        number: apiData.asn?.asn || null,
        organization: apiData.asn?.org || null,
        route: apiData.asn?.route || null,
        type: apiData.asn?.type || null,
      },
      // Geolocation
      location: {
        city: apiData.location?.city || null,
        region: apiData.location?.state || apiData.location?.region || null,
        country: apiData.location?.country || null,
        countryCode: apiData.location?.country_code || null,
        postalCode: apiData.location?.postal || null,
        latitude: apiData.location?.latitude || null,
        longitude: apiData.location?.longitude || null,
        timezone: apiData.location?.timezone || null,
      },
      // Connection Info
      connection: {
        isp: apiData.asn?.org || null,
        isVpn: apiData.is_vpn || false,
        isProxy: apiData.is_proxy || false,
        isTor: apiData.is_tor || false,
        isDatacenter: apiData.is_datacenter || false,
        isHosting: apiData.company?.type === 'hosting',
      },
      // Raw data for advanced use
      raw: apiData,
    };
  }

  /**
   * Identify potential company from IP for lead enrichment
   * @param {string} ip - Visitor IP address
   * @returns {Promise<Object>} Company identification result
   */
  async identifyCompany(ip) {
    const lookup = await this.lookup(ip);

    // Skip if it's a VPN, proxy, or hosting provider
    if (lookup.connection.isVpn || lookup.connection.isProxy ||
        lookup.connection.isTor || lookup.connection.isHosting) {
      return {
        identified: false,
        reason: 'VPN/Proxy/Hosting detected',
        ip,
        location: lookup.location,
      };
    }

    // Check if we have company info
    if (lookup.company.name && lookup.company.type === 'business') {
      return {
        identified: true,
        company: lookup.company,
        location: lookup.location,
        asn: lookup.asn,
        ip,
      };
    }

    return {
      identified: false,
      reason: 'No business company identified',
      ip,
      location: lookup.location,
      asn: lookup.asn,
    };
  }

  /**
   * Batch lookup multiple IPs
   * @param {string[]} ips - Array of IP addresses
   * @returns {Promise<Object[]>} Array of lookup results
   */
  async batchLookup(ips) {
    const results = await Promise.allSettled(
      ips.map(ip => this.lookup(ip))
    );

    return results.map((result, index) => ({
      ip: ips[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
    }));
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
const ipLookupService = new IpLookupService();

module.exports = { ipLookupService, IpLookupService };
