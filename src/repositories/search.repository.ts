import { flatten, keyBy } from 'lodash';

import { Client } from '../core/client';
import { CompanySearchHit } from '../entities/company-search-hit.entity';
import { LinkedInMiniCompany, MINI_COMPANY_TYPE } from '../entities/linkedin-mini-company.entity';
import { ProfileId } from '../entities/mini-profile.entity';
import { PeopleSearchHit } from '../entities/people-search-hit.entity';
import { GetBlendedSearchResponse } from '../responses/blended-search.reponse.get';
import { CompanySearchScroller } from '../scrollers/company-search.scroller';
import { PeopleSearchScroller } from '../scrollers/people-search.scroller';
import { LinkedInNetworkType } from '../types/network.enum';
import { PeopleSearchFilters } from '../types/people-search-filters';
import { SearchResultType } from '../types/search-result-type.enum';
import { LinkedInSearchType } from '../types/search-type.enum';
import { getProfilesFromResponse } from './profile.repository';

export class SearchRepository {
  client: Client;

  constructor({ client }: { client: Client }) {
    this.client = client;
  }

  searchPeople({
    skip = 0,
    limit = 10,
    filters = {},
    keywords,
  }: {
    skip?: number;
    limit?: number;
    filters?: PeopleSearchFilters;
    keywords?: string;
  } = {}): PeopleSearchScroller {
    return new PeopleSearchScroller({
      skip,
      limit,
      filters,
      keywords,
      fetchPeople: this.fetchPeople.bind(this),
    });
  }

  searchCompanies({
    skip = 0,
    limit = 10,
    keywords,
  }: {
    skip?: number;
    limit?: number;
    keywords?: string;
  } = {}): CompanySearchScroller {
    return new CompanySearchScroller({
      skip,
      limit,
      keywords,
      fetchCompanies: this.fetchCompanies.bind(this),
    });
  }

  searchOwnConnections({
    skip = 0,
    limit = 10,
    filters = {},
    keywords,
  }: {
    skip?: number;
    limit?: number;
    filters?: Omit<PeopleSearchFilters, 'network'>;
    keywords?: string;
  } = {}): PeopleSearchScroller {
    return new PeopleSearchScroller({
      skip,
      limit,
      keywords,
      filters: { ...filters, network: LinkedInNetworkType.F },
      fetchPeople: this.fetchPeople.bind(this),
    });
  }

  searchConnectionsOf({
    profileId,
    skip = 0,
    limit = 10,
    filters = {},
    keywords,
  }: {
    profileId: ProfileId;
    skip?: number;
    limit?: number;
    filters?: Omit<PeopleSearchFilters, 'network' | 'connectionOf'>;
    keywords?: string;
  }): PeopleSearchScroller {
    return new PeopleSearchScroller({
      skip,
      limit,
      keywords,
      filters: { ...filters, connectionOf: profileId, network: LinkedInNetworkType.F },
      fetchPeople: this.fetchPeople.bind(this),
    });
  }

  private async fetchPeople({
    skip = 0,
    limit = 10,
    filters = {},
    keywords,
  }: {
    skip?: number;
    limit?: number;
    filters?: PeopleSearchFilters;
    keywords?: string;
  } = {}): Promise<PeopleSearchHit[]> {
    const response = await this.client.request.search.searchBlended({
      keywords,
      skip,
      limit,
      filters: { ...filters, resultType: LinkedInSearchType.PEOPLE },
    });

    const profiles = keyBy(getProfilesFromResponse<GetBlendedSearchResponse>(response), 'entityUrn');
    const searchHits = flatten(
      response.data.elements.filter(e => e.type === SearchResultType.SEARCH_HITS && e.elements).map(e => e.elements!),
    );

    return searchHits.map(searchHit => ({
      ...searchHit,
      profile: profiles[searchHit.targetUrn],
    }));
  }

  private async fetchCompanies({
    skip = 0,
    limit = 10,
    keywords,
  }: {
    skip?: number;
    limit?: number;
    keywords?: string;
  }): Promise<CompanySearchHit[]> {
    const response = await this.client.request.search.searchBlended({
      skip,
      limit,
      keywords,
      filters: { resultType: LinkedInSearchType.COMPANIES },
    });

    const companies = response.included.filter(entity => entity.$type === MINI_COMPANY_TYPE) as LinkedInMiniCompany[];
    const companiesByUrn = keyBy(companies, 'entityUrn');
    const searchHits = flatten(
      response.data.elements.filter(e => e.type === SearchResultType.SEARCH_HITS && e.elements).map(e => e.elements!),
    );

    return searchHits.map(searchHit => ({
      ...searchHit,
      company: companiesByUrn[searchHit.targetUrn],
    }));
  }
}
