#!/usr/bin/env node
import dotenv from "dotenv";

dotenv.config();
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequest, CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum, PublicObjectSearchRequest } from "@hubspot/api-client/lib/codegen/crm/companies/index.js";
let mcpServer: Server;

// Type definitions for tool arguments
interface SearchContactsArgs {
  query: string;
  count?: number;
  propertyList?: string[];
}

interface GetSalesAnalyticsArgs {
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: string; // ISO format date
  endDate?: string; // ISO format date
  pipeline?: string; // Pipeline ID
  dealStage?: string; // Deal stage ID
  dealOwner?: string; // Owner ID
}

interface GetDealHistoryArgs {
  dealId: string;
}

interface GetDealNotesArgs {
  dealId: string;
  limit?: number;
  after?: string;
}

interface GetEngagementsByDealArgs {
  dealId: string;
  types?: Array<"CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE">;
  limit?: number;
  after?: string;
}

interface GetSalesPerformanceArgs {
  ownerIds?: string[];
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: string; // ISO format date
  endDate?: string; // ISO format date
  pipeline?: string; // Pipeline ID
}

interface GetPipelineAnalyticsArgs {
  pipelineId: string;
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: string; // ISO format date
  endDate?: string; // ISO format date
}

interface GetForecastAnalyticsArgs {
  period: "monthly" | "quarterly" | "yearly";
  numberOfPeriods?: number;
  pipeline?: string; // Pipeline ID
}

interface GetContactArgs {
  contactId: string;
  properties?: string[];
}

interface CreateContactArgs {
  properties: {
    email: string;
    firstname?: string;
    lastname?: string;
    [key: string]: any;
  };
}

interface UpdateContactArgs {
  contactId: string;
  properties: {
    [key: string]: any;
  };
}

interface ListDealsArgs {
  limit?: number;
  after?: string;
  properties?: string[];
}

interface GetDealArgs {
  dealId: string;
  properties?: string[];
}

interface CreateDealArgs {
  properties: {
    dealname: string;
    amount?: number;
    dealstage?: string;
    pipeline?: string;
    [key: string]: any;
  };
}

interface UpdateDealArgs {
  dealId: string;
  properties: {
    [key: string]: any;
  };
}

interface ListCompaniesArgs {
  limit?: number;
  after?: string;
  properties?: string[];
}

interface GetCompanyArgs {
  companyId: string;
  properties?: string[];
}

// Tool definitions
const searchContactsTool: Tool = {
  name: "hubspot_search_contacts",
  description: "Search for contacts in HubSpot using a query string",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query string (email, name, etc.)",
      },
      count: {
        type: "number",
        description: "Maximum number of contacts to return (default 10)",
      },
      propertyList: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of properties to include in the results",
      },
    },
    required: ["query"],
  },
};

const getContactTool: Tool = {
  name: "hubspot_get_contact",
  description: "Get a specific contact by ID",
  inputSchema: {
    type: "object",
    properties: {
      contactId: {
        type: "string",
        description: "The ID of the contact to retrieve",
      },
      properties: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of properties to include in the results",
      },
    },
    required: ["contactId"],
  },
};

const createContactTool: Tool = {
  name: "hubspot_create_contact",
  description: "Create a new contact in HubSpot",
  inputSchema: {
    type: "object",
    properties: {
      properties: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "Contact's email address",
          },
          firstname: {
            type: "string",
            description: "Contact's first name",
          },
          lastname: {
            type: "string",
            description: "Contact's last name",
          },
        },
        required: ["email"],
        additionalProperties: true,
        description: "Contact properties",
      },
    },
    required: ["properties"],
  },
};

const updateContactTool: Tool = {
  name: "hubspot_update_contact",
  description: "Update an existing contact in HubSpot",
  inputSchema: {
    type: "object",
    properties: {
      contactId: {
        type: "string",
        description: "The ID of the contact to update",
      },
      properties: {
        type: "object",
        additionalProperties: true,
        description: "Contact properties to update",
      },
    },
    required: ["contactId", "properties"],
  },
};

const listDealsTool: Tool = {
  name: "hubspot_list_deals",
  description: "List deals in HubSpot with pagination",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of deals to return (default 10, max 100)",
        default: 10,
      },
      after: {
        type: "string",
        description: "Pagination cursor for next page of results",
      },
      properties: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of properties to include in the results",
      },
    },
  },
};

const getDealTool: Tool = {
  name: "hubspot_get_deal",
  description: "Get a specific deal by ID",
  inputSchema: {
    type: "object",
    properties: {
      dealId: {
        type: "string",
        description: "The ID of the deal to retrieve",
      },
      properties: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of properties to include in the results",
      },
    },
    required: ["dealId"],
  },
};

const createDealTool: Tool = {
  name: "hubspot_create_deal",
  description: "Create a new deal in HubSpot",
  inputSchema: {
    type: "object",
    properties: {
      properties: {
        type: "object",
        properties: {
          dealname: {
            type: "string",
            description: "Name of the deal",
          },
          amount: {
            type: "number",
            description: "Deal amount",
          },
          dealstage: {
            type: "string",
            description: "Stage of the deal (ID)",
          },
          pipeline: {
            type: "string",
            description: "Pipeline ID",
          },
        },
        required: ["dealname"],
        additionalProperties: true,
        description: "Deal properties",
      },
    },
    required: ["properties"],
  },
};

const updateDealTool: Tool = {
  name: "hubspot_update_deal",
  description: "Update an existing deal in HubSpot",
  inputSchema: {
    type: "object",
    properties: {
      dealId: {
        type: "string",
        description: "The ID of the deal to update",
      },
      properties: {
        type: "object",
        additionalProperties: true,
        description: "Deal properties to update",
      },
    },
    required: ["dealId", "properties"],
  },
};

const listCompaniesTool: Tool = {
  name: "hubspot_list_companies",
  description: "List companies in HubSpot with pagination",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of companies to return (default 10, max 100)",
        default: 10,
      },
      after: {
        type: "string",
        description: "Pagination cursor for next page of results",
      },
      properties: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of properties to include in the results",
      },
    },
  },
};

const getCompanyTool: Tool = {
  name: "hubspot_get_company",
  description: "Get a specific company by ID",
  inputSchema: {
    type: "object",
    properties: {
      companyId: {
        type: "string",
        description: "The ID of the company to retrieve",
      },
      properties: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of properties to include in the results",
      },
    },
    required: ["companyId"],
  },
};

const getSalesAnalyticsTool: Tool = {
  name: "hubspot_get_sales_analytics",
  description: "Get aggregated sales analytics data for specific time periods",
  inputSchema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
        description: "Time period to group analytics data by",
      },
      startDate: {
        type: "string",
        description: "Start date for analysis in ISO format (YYYY-MM-DD)",
      },
      endDate: {
        type: "string",
        description: "End date for analysis in ISO format (YYYY-MM-DD)",
      },
      pipeline: {
        type: "string",
        description: "Pipeline ID to filter by",
      },
      dealStage: {
        type: "string",
        description: "Deal stage ID to filter by",
      },
      dealOwner: {
        type: "string",
        description: "Deal owner ID to filter by",
      },
    },
    required: ["period", "startDate"],
  },
};

const getDealHistoryTool: Tool = {
  name: "hubspot_get_deal_history",
  description: "Get the complete history of changes to a deal",
  inputSchema: {
    type: "object",
    properties: {
      dealId: {
        type: "string",
        description: "The ID of the deal to get history for",
      },
    },
    required: ["dealId"],
  },
};

const getDealNotesTool: Tool = {
  name: "hubspot_get_deal_notes",
  description: "Get notes associated with a specific deal",
  inputSchema: {
    type: "object",
    properties: {
      dealId: {
        type: "string",
        description: "The ID of the deal to get notes for",
      },
      limit: {
        type: "number",
        description: "Maximum number of notes to return (default 20)",
        default: 20,
      },
      after: {
        type: "string",
        description: "Pagination cursor for next page of results",
      },
    },
    required: ["dealId"],
  },
};

const getEngagementsByDealTool: Tool = {
  name: "hubspot_get_engagements_by_deal",
  description: "Get all engagement activities (calls, emails, meetings, etc.) associated with a deal",
  inputSchema: {
    type: "object",
    properties: {
      dealId: {
        type: "string",
        description: "The ID of the deal to get engagements for",
      },
      types: {
        type: "array",
        items: {
          type: "string",
          enum: ["CALL", "EMAIL", "MEETING", "TASK", "NOTE"],
        },
        description: "Types of engagements to include",
      },
      limit: {
        type: "number",
        description: "Maximum number of engagements to return (default 20)",
        default: 20,
      },
      after: {
        type: "string",
        description: "Pagination cursor for next page of results",
      },
    },
    required: ["dealId"],
  },
};

const getSalesPerformanceTool: Tool = {
  name: "hubspot_get_sales_performance",
  description: "Get performance metrics for sales reps over a specific time period",
  inputSchema: {
    type: "object",
    properties: {
      ownerIds: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of owner IDs to include in the analysis",
      },
      period: {
        type: "string",
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
        description: "Time period to group performance data by",
      },
      startDate: {
        type: "string",
        description: "Start date for analysis in ISO format (YYYY-MM-DD)",
      },
      endDate: {
        type: "string",
        description: "End date for analysis in ISO format (YYYY-MM-DD)",
      },
      pipeline: {
        type: "string",
        description: "Pipeline ID to filter by",
      },
    },
    required: ["period", "startDate"],
  },
};

const getPipelineAnalyticsTool: Tool = {
  name: "hubspot_get_pipeline_analytics",
  description: "Get analytics for a specific sales pipeline including conversion rates between stages",
  inputSchema: {
    type: "object",
    properties: {
      pipelineId: {
        type: "string",
        description: "The ID of the pipeline to analyze",
      },
      period: {
        type: "string",
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
        description: "Time period to group analytics data by",
      },
      startDate: {
        type: "string",
        description: "Start date for analysis in ISO format (YYYY-MM-DD)",
      },
      endDate: {
        type: "string",
        description: "End date for analysis in ISO format (YYYY-MM-DD)",
      },
    },
    required: ["pipelineId", "period", "startDate"],
  },
};

const getForecastAnalyticsTool: Tool = {
  name: "hubspot_get_forecast_analytics",
  description: "Get forecasted sales data based on current pipeline and historical performance",
  inputSchema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        enum: ["monthly", "quarterly", "yearly"],
        description: "Time period to group forecast data by",
      },
      numberOfPeriods: {
        type: "number",
        description: "Number of future periods to forecast (default 3)",
        default: 3,
      },
      pipeline: {
        type: "string",
        description: "Pipeline ID to filter by",
      },
    },
    required: ["period"],
  },
};

class HubSpotClient {
  private client: Client;

  constructor(apiKey: string) {
    this.client = new Client({ accessToken: apiKey });
  }

  async searchContacts(query: string, count: number = 10, propertyList?: string[]): Promise<any> {
    const publicObjectSearchRequest: PublicObjectSearchRequest = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: FilterOperatorEnum.ContainsToken,
              value: query,
            },
          ],
        },
      ],
      sorts: ["lastmodifieddate"],
      properties: propertyList || ["email", "firstname", "lastname", "phone"],
      limit: count,
    };

    return await this.client.crm.contacts.searchApi.doSearch(publicObjectSearchRequest);
  }

  async getContact(contactId: string, properties?: string[]): Promise<any> {
    return await this.client.crm.contacts.basicApi.getById(contactId, properties || ["email", "firstname", "lastname", "phone"]);
  }

  async createContact(properties: { [key: string]: any }): Promise<any> {
    const contactInput = {
      properties,
    };
    return await this.client.crm.contacts.basicApi.create(contactInput);
  }

  async updateContact(contactId: string, properties: { [key: string]: any }): Promise<any> {
    const contactInput = {
      properties,
    };
    return await this.client.crm.contacts.basicApi.update(contactId, contactInput);
  }

  async listDeals(limit: number = 10, after?: string, properties?: string[]): Promise<any> {
    return await this.client.crm.deals.basicApi.getPage(
      limit,
      after,
      properties || ["dealname", "amount", "dealstage", "closedate"],
      undefined,
      undefined,
      undefined
    );
  }

  async getDeal(dealId: string, properties?: string[]): Promise<any> {
    return await this.client.crm.deals.basicApi.getById(dealId, properties || ["dealname", "amount", "dealstage", "closedate"]);
  }

  async createDeal(properties: { [key: string]: any }): Promise<any> {
    const dealInput = {
      properties,
    };
    return await this.client.crm.deals.basicApi.create(dealInput);
  }

  async updateDeal(dealId: string, properties: { [key: string]: any }): Promise<any> {
    const dealInput = {
      properties,
    };
    return await this.client.crm.deals.basicApi.update(dealId, dealInput);
  }

  async listCompanies(limit: number = 10, after?: string, properties?: string[]): Promise<any> {
    return await this.client.crm.companies.basicApi.getPage(
      limit,
      after,
      properties || ["name", "domain", "phone", "address"],
      undefined,
      undefined,
      undefined
    );
  }

  async getCompany(companyId: string, properties?: string[]): Promise<any> {
    return await this.client.crm.companies.basicApi.getById(companyId, properties || ["name", "domain", "phone", "address"]);
  }

  async getSalesAnalytics(
    period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
    startDate: string,
    endDate?: string,
    pipeline?: string,
    dealStage?: string,
    dealOwner?: string
  ): Promise<any> {
    // We'll need to gather deal data and then do our own aggregation
    // First, get all deals within the timeframe
    const allDeals = await this.getAllDeals(startDate, endDate, pipeline, dealStage, dealOwner);

    // Group and aggregate deals by the requested period
    return this.aggregateDealsByPeriod(allDeals, period, startDate, endDate);
  }

  private async getAllDeals(
    startDate: string,
    endDate?: string,
    pipeline?: string,
    dealStage?: string,
    dealOwner?: string
  ): Promise<any[]> {
    // Need to use search API to filter deals effectively
    const filterGroups = [];

    // Date range filter
    const dateFilters = [];
    dateFilters.push({
      propertyName: "createdate",
      operator: FilterOperatorEnum.Gte,
      value: new Date(startDate).getTime().toString(),
    });

    if (endDate) {
      dateFilters.push({
        propertyName: "createdate",
        operator: FilterOperatorEnum.Lte,
        value: new Date(endDate).getTime().toString(),
      });
    }

    filterGroups.push({ filters: dateFilters });

    // Additional filters
    if (pipeline || dealStage || dealOwner) {
      const additionalFilters = [];

      if (pipeline) {
        additionalFilters.push({
          propertyName: "pipeline",
          operator: FilterOperatorEnum.Eq,
          value: pipeline,
        });
      }

      if (dealStage) {
        additionalFilters.push({
          propertyName: "dealstage",
          operator: FilterOperatorEnum.Eq,
          value: dealStage,
        });
      }

      if (dealOwner) {
        additionalFilters.push({
          propertyName: "hubspot_owner_id",
          operator: FilterOperatorEnum.Eq,
          value: dealOwner,
        });
      }

      filterGroups.push({ filters: additionalFilters });
    }

    const searchRequest: PublicObjectSearchRequest = {
      filterGroups,
      sorts: ["createdate"],
      properties: ["dealname", "amount", "createdate", "closedate", "dealstage", "pipeline", "hubspot_owner_id"],
      limit: 100, // Maximum per request
    };

    // Need to handle pagination for potentially large datasets
    let allDeals: any[] = [];
    let hasMore = true;
    let after = undefined;

    while (hasMore) {
      const response = await this.client.crm.deals.searchApi.doSearch({
        ...searchRequest,
        after,
      });

      allDeals = [...allDeals, ...response.results];

      if (response.paging && response.paging.next) {
        after = response.paging.next.after;
      } else {
        hasMore = false;
      }
    }

    return allDeals;
  }

  private aggregateDealsByPeriod(
    deals: any[],
    period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
    startDate: string,
    endDate?: string
  ): any {
    const endDateObj = endDate ? new Date(endDate) : new Date();
    const startDateObj = new Date(startDate);

    // Group deals by period
    const dealsByPeriod: { [key: string]: any[] } = {};

    deals.forEach((deal) => {
      const createDate = new Date(deal.properties.createdate);
      let periodKey;

      switch (period) {
        case "daily":
          periodKey = createDate.toISOString().split("T")[0];
          break;
        case "weekly":
          // Get the start of the week (Sunday)
          const day = createDate.getUTCDay();
          const diff = createDate.getUTCDate() - day;
          const weekStart = new Date(createDate);
          weekStart.setUTCDate(diff);
          periodKey = weekStart.toISOString().split("T")[0];
          break;
        case "monthly":
          periodKey = `${createDate.getUTCFullYear()}-${(createDate.getUTCMonth() + 1).toString().padStart(2, "0")}`;
          break;
        case "quarterly":
          const quarter = Math.floor(createDate.getUTCMonth() / 3) + 1;
          periodKey = `${createDate.getUTCFullYear()}-Q${quarter}`;
          break;
        case "yearly":
          periodKey = createDate.getUTCFullYear().toString();
          break;
      }

      if (!dealsByPeriod[periodKey]) {
        dealsByPeriod[periodKey] = [];
      }

      dealsByPeriod[periodKey].push(deal);
    });

    // Aggregate data for each period
    const analytics = Object.keys(dealsByPeriod).map((periodKey) => {
      const periodDeals = dealsByPeriod[periodKey];
      const totalDeals = periodDeals.length;
      let totalAmount = 0;
      let wonDeals = 0;
      let lostDeals = 0;
      let openDeals = 0;

      periodDeals.forEach((deal) => {
        // Sum up the deal amounts (if available)
        if (deal.properties.amount) {
          totalAmount += parseFloat(deal.properties.amount);
        }

        // Count deals by status (assuming standard deal stages)
        const stage = deal.properties.dealstage;
        if (stage && stage.includes("closedwon")) {
          wonDeals++;
        } else if (stage && stage.includes("closedlost")) {
          lostDeals++;
        } else {
          openDeals++;
        }
      });

      return {
        period: periodKey,
        totalDeals,
        totalAmount,
        wonDeals,
        lostDeals,
        openDeals,
        winRate: totalDeals > 0 ? wonDeals / (wonDeals + lostDeals) : 0,
        averageDealSize: totalDeals > 0 ? totalAmount / totalDeals : 0,
      };
    });

    // Sort by period
    analytics.sort((a, b) => a.period.localeCompare(b.period));

    return {
      startDate: startDateObj.toISOString().split("T")[0],
      endDate: endDateObj.toISOString().split("T")[0],
      period,
      analytics,
    };
  }

  async getDealHistory(dealId: string): Promise<any> {
    try {
      return await this.client.crm.deals.basicApi.getById(dealId, ["hs_lastmodifieddate"]);
    } catch (error) {
      console.error("Error getting deal history:", error);
      throw error;
    }
  }

  async getDealNotes(dealId: string, limit: number = 20, after?: string): Promise<any> {
    try {
      // First, we need to check if the deal exists
      await this.client.crm.deals.basicApi.getById(dealId, ["dealname"]);

      // Use a more direct approach: get notes and filter by association
      const params: any = {
        limit,
      };

      if (after) {
        params.after = after;
      }

      // Use search endpoint instead of associations
      const searchRequest: PublicObjectSearchRequest = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "hs_attachment_ids",
                operator: FilterOperatorEnum.ContainsToken,
                value: dealId,
              },
            ],
          },
        ],
        sorts: ["hs_createdate"],
        properties: ["hs_note_body", "hs_createdate", "hs_lastmodifieddate"],
        limit,
      };

      const response = await this.client.crm.objects.notes.searchApi.doSearch(searchRequest);

      return {
        results: response.results || [],
        paging: response.paging,
      };
    } catch (error) {
      console.error("Error getting deal notes:", error);
      throw error;
    }
  }

  async getEngagementsByDeal(
    dealId: string,
    types?: Array<"CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE">,
    limit: number = 20,
    after?: string
  ): Promise<any> {
    try {
      // First, we need to check if the deal exists
      await this.client.crm.deals.basicApi.getById(dealId, ["dealname"]);

      // Map engagement types to HubSpot object types
      const typeMap: { [key: string]: string } = {
        CALL: "calls",
        EMAIL: "emails",
        MEETING: "meetings",
        TASK: "tasks",
        NOTE: "notes",
      };

      // If no types specified, get all types
      const engagementTypes = types && types.length > 0 ? types.map((type) => typeMap[type]) : Object.values(typeMap);

      // For each type, use the search API instead of associations
      const enrichedEngagements: any[] = [];

      for (const engagementType of engagementTypes) {
        // Search for engagements associated with this deal
        // This is a simplified approach - in a real implementation, you would use the proper association property
        const searchRequest: PublicObjectSearchRequest = {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "hs_attachment_ids",
                  operator: FilterOperatorEnum.ContainsToken,
                  value: dealId,
                },
              ],
            },
          ],
          sorts: ["hs_createdate"],
          limit,
          properties: [
            "hs_createdate",
            "hs_lastmodifieddate",
            // Add relevant properties based on engagement type
            ...(engagementType === "calls" ? ["hs_call_body", "hs_call_direction", "hs_call_disposition", "hs_call_duration"] : []),
            ...(engagementType === "emails" ? ["hs_email_subject", "hs_email_text", "hs_email_direction", "hs_email_status"] : []),
            ...(engagementType === "meetings"
              ? ["hs_meeting_title", "hs_meeting_body", "hs_meeting_start_time", "hs_meeting_end_time"]
              : []),
            ...(engagementType === "tasks" ? ["hs_task_body", "hs_task_priority", "hs_task_status", "hs_task_subject"] : []),
            ...(engagementType === "notes" ? ["hs_note_body"] : []),
          ],
        };

        try {
          // The API path will differ based on engagement type
          let response: any;

          switch (engagementType) {
            case "calls":
              response = await this.client.crm.objects.calls.searchApi.doSearch(searchRequest);
              break;
            case "emails":
              response = await this.client.crm.objects.emails.searchApi.doSearch(searchRequest);
              break;
            case "meetings":
              response = await this.client.crm.objects.meetings.searchApi.doSearch(searchRequest);
              break;
            case "tasks":
              response = await this.client.crm.objects.tasks.searchApi.doSearch(searchRequest);
              break;
            case "notes":
              response = await this.client.crm.objects.notes.searchApi.doSearch(searchRequest);
              break;
          }

          if (response && response.results) {
            // Add the type to each engagement
            response.results.forEach((result: any) => {
              result.engagementType = engagementType;
              enrichedEngagements.push(result);
            });
          }
        } catch (err) {
          console.error(`Error getting ${engagementType} for deal ${dealId}:`, err);
        }
      }

      // Sort by created date (newest first)
      enrichedEngagements.sort((a: any, b: any) => {
        const dateA = new Date(a.properties.hs_createdate || 0).getTime();
        const dateB = new Date(b.properties.hs_createdate || 0).getTime();
        return dateB - dateA;
      });

      // Limit to the requested number
      const limitedEngagements = enrichedEngagements.slice(0, limit);

      return {
        results: limitedEngagements,
        totalCount: enrichedEngagements.length,
      };
    } catch (error) {
      console.error("Error getting engagements for deal:", error);
      throw error;
    }
  }

  async getSalesPerformance(
    period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
    startDate: string,
    endDate?: string,
    ownerIds?: string[],
    pipeline?: string
  ): Promise<any> {
    try {
      // Get all deals for the specified period
      const allDeals = await this.getAllDeals(startDate, endDate, pipeline);

      // Filter by owner IDs if provided
      const filteredDeals =
        ownerIds && ownerIds.length > 0 ? allDeals.filter((deal) => ownerIds.includes(deal.properties.hubspot_owner_id)) : allDeals;

      // Group deals by owner
      const dealsByOwner: { [key: string]: any[] } = {};

      filteredDeals.forEach((deal) => {
        const ownerId = deal.properties.hubspot_owner_id;
        if (!ownerId) return;

        if (!dealsByOwner[ownerId]) {
          dealsByOwner[ownerId] = [];
        }

        dealsByOwner[ownerId].push(deal);
      });

      // Get owner details for each owner with deals
      const ownerDetails: { [key: string]: any } = {};

      for (const ownerId of Object.keys(dealsByOwner)) {
        try {
          // Cast the ID to number as required by the API
          const ownerResponse = await this.client.crm.owners.ownersApi.getById(parseInt(ownerId, 10));
          ownerDetails[ownerId] = {
            id: ownerId,
            firstName: ownerResponse.firstName,
            lastName: ownerResponse.lastName,
            email: ownerResponse.email,
          };
        } catch (error) {
          console.error(`Error getting owner details for ${ownerId}:`, error);
          ownerDetails[ownerId] = { id: ownerId };
        }
      }

      // Generate performance metrics for each owner
      const ownerPerformance = Object.keys(dealsByOwner).map((ownerId) => {
        const ownerDeals = dealsByOwner[ownerId];
        const performance = this.calculatePerformanceMetrics(ownerDeals, period);

        return {
          owner: ownerDetails[ownerId],
          ...performance,
        };
      });

      // Sort by most revenue
      ownerPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);

      return {
        startDate: new Date(startDate).toISOString().split("T")[0],
        endDate: endDate ? new Date(endDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        period,
        performance: ownerPerformance,
      };
    } catch (error) {
      console.error("Error getting sales performance:", error);
      throw error;
    }
  }

  private calculatePerformanceMetrics(deals: any[], period: string): any {
    // Group deals by status
    const closedWonDeals = deals.filter((deal) => {
      const stage = deal.properties.dealstage;
      return stage && stage.includes("closedwon");
    });

    const closedLostDeals = deals.filter((deal) => {
      const stage = deal.properties.dealstage;
      return stage && stage.includes("closedlost");
    });

    const openDeals = deals.filter((deal) => {
      const stage = deal.properties.dealstage;
      return !(stage && (stage.includes("closedwon") || stage.includes("closedlost")));
    });

    // Calculate metrics
    const totalDeals = deals.length;
    const totalWon = closedWonDeals.length;
    const totalLost = closedLostDeals.length;
    const totalOpen = openDeals.length;

    let totalRevenue = 0;
    let averageDealSize = 0;

    closedWonDeals.forEach((deal) => {
      if (deal.properties.amount) {
        totalRevenue += parseFloat(deal.properties.amount);
      }
    });

    if (totalWon > 0) {
      averageDealSize = totalRevenue / totalWon;
    }

    const winRate = totalWon + totalLost > 0 ? totalWon / (totalWon + totalLost) : 0;

    return {
      totalDeals,
      totalWon,
      totalLost,
      totalOpen,
      totalRevenue,
      averageDealSize,
      winRate,
    };
  }

  async getPipelineAnalytics(
    pipelineId: string,
    period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
    startDate: string,
    endDate?: string
  ): Promise<any> {
    try {
      // Get the pipeline stages first
      const pipeline = await this.client.crm.pipelines.pipelinesApi.getById("deals", pipelineId);

      if (!pipeline || !pipeline.stages || pipeline.stages.length === 0) {
        throw new Error(`Pipeline ${pipelineId} not found or has no stages`);
      }

      // Get all deals in this pipeline
      const allDeals = await this.getAllDeals(startDate, endDate, pipelineId);

      // Create a mapping of stage IDs to stage data
      const stageMap: { [key: string]: any } = {};
      pipeline.stages.forEach((stage) => {
        stageMap[stage.id] = {
          id: stage.id,
          label: stage.label,
          displayOrder: stage.displayOrder,
          totalDeals: 0,
          totalValue: 0,
          deals: [],
          conversionRate: 0, // Will calculate later
        };
      });

      // Group deals by stage
      allDeals.forEach((deal) => {
        const stageId = deal.properties.dealstage;
        if (stageMap[stageId]) {
          stageMap[stageId].totalDeals++;
          stageMap[stageId].deals.push(deal);

          if (deal.properties.amount) {
            stageMap[stageId].totalValue += parseFloat(deal.properties.amount);
          }
        }
      });

      // Calculate conversion rates between stages
      const stages = Object.values(stageMap).sort((a: any, b: any) => a.displayOrder - b.displayOrder);

      for (let i = 0; i < stages.length - 1; i++) {
        const currentStage = stages[i] as any;
        const nextStage = stages[i + 1] as any;

        if (currentStage.totalDeals > 0) {
          nextStage.conversionRate = nextStage.totalDeals / currentStage.totalDeals;
        }
      }

      // Calculate time spent in each stage (average)
      stages.forEach((stage: any) => {
        let totalDays = 0;
        let dealsWithDates = 0;

        stage.deals.forEach((deal: any) => {
          // This is a simplification since HubSpot doesn't directly expose time in stage
          // In a real implementation, you'd track stage changes in the deal history
          const createDate = new Date(deal.properties.createdate);
          const closeDate = deal.properties.closedate ? new Date(deal.properties.closedate) : new Date();

          if (createDate && closeDate) {
            const daysDiff = Math.ceil((closeDate.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24));
            totalDays += daysDiff;
            dealsWithDates++;
          }
        });

        stage.averageDaysInStage = dealsWithDates > 0 ? totalDays / dealsWithDates : 0;

        // Clean up the deals array to reduce response size
        delete stage.deals;
      });

      return {
        pipelineId,
        pipelineName: pipeline.label,
        startDate: new Date(startDate).toISOString().split("T")[0],
        endDate: endDate ? new Date(endDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        period,
        stages,
      };
    } catch (error) {
      console.error("Error getting pipeline analytics:", error);
      throw error;
    }
  }

  async getForecastAnalytics(period: "monthly" | "quarterly" | "yearly", numberOfPeriods: number = 3, pipeline?: string): Promise<any> {
    try {
      // For forecasting, we need historical data to predict future performance
      // Using a simple approach based on recent performance and current pipeline

      // Define the end date as today
      const today = new Date();
      let startDate;

      // For the historical period, look back 3x the forecast period
      switch (period) {
        case "monthly":
          startDate = new Date(today);
          startDate.setMonth(today.getMonth() - numberOfPeriods * 3);
          break;
        case "quarterly":
          startDate = new Date(today);
          startDate.setMonth(today.getMonth() - numberOfPeriods * 3 * 3);
          break;
        case "yearly":
          startDate = new Date(today);
          startDate.setFullYear(today.getFullYear() - numberOfPeriods * 3);
          break;
      }

      // Get historical deals to analyze
      const allDeals = await this.getAllDeals(startDate.toISOString(), today.toISOString(), pipeline);

      // Group historical deals by period
      const historicalData = this.aggregateDealsByPeriod(allDeals, period, startDate.toISOString(), today.toISOString());

      // Get current pipeline (open deals)
      const openDeals = await this.getOpenDeals(pipeline);

      // Generate forecast
      const forecast = this.generateForecast(historicalData.analytics, openDeals, period, numberOfPeriods);

      return {
        period,
        numberOfPeriods,
        historicalData: historicalData.analytics,
        forecast,
      };
    } catch (error) {
      console.error("Error generating forecast analytics:", error);
      throw error;
    }
  }

  private async getOpenDeals(pipeline?: string): Promise<any[]> {
    const filterGroups = [];

    // Filter for open deals (not closed won/lost)
    const stageFilters = [];
    stageFilters.push({
      propertyName: "dealstage",
      operator: FilterOperatorEnum.NotHasProperty,
      value: "closed",
    });

    filterGroups.push({ filters: stageFilters });

    // Pipeline filter if specified
    if (pipeline) {
      filterGroups.push({
        filters: [
          {
            propertyName: "pipeline",
            operator: FilterOperatorEnum.Eq,
            value: pipeline,
          },
        ],
      });
    }

    const searchRequest: PublicObjectSearchRequest = {
      filterGroups,
      sorts: ["amount"],
      properties: ["dealname", "amount", "dealstage", "pipeline", "closedate", "hs_probability"],
      limit: 100,
    };

    // Get all open deals with pagination
    let allDeals: any[] = [];
    let hasMore = true;
    let after = undefined;

    while (hasMore) {
      const response = await this.client.crm.deals.searchApi.doSearch({
        ...searchRequest,
        after,
      });

      allDeals = [...allDeals, ...response.results];

      if (response.paging && response.paging.next) {
        after = response.paging.next.after;
      } else {
        hasMore = false;
      }
    }

    return allDeals;
  }

  private generateForecast(
    historicalData: any[],
    openDeals: any[],
    period: "monthly" | "quarterly" | "yearly",
    numberOfPeriods: number
  ): any[] {
    // Calculate average metrics from historical data
    let totalRevenue = 0;
    let totalDeals = 0;
    let totalWinRate = 0;

    historicalData.forEach((data) => {
      totalRevenue += data.totalAmount;
      totalDeals += data.totalDeals;
      if (data.winRate) totalWinRate += data.winRate;
    });

    const avgRevenuePerPeriod = historicalData.length > 0 ? totalRevenue / historicalData.length : 0;
    const avgDealsPerPeriod = historicalData.length > 0 ? totalDeals / historicalData.length : 0;
    const avgWinRate = historicalData.length > 0 ? totalWinRate / historicalData.length : 0;

    // Analyze open deals to add to the forecast
    // Group them by expected close period
    const dealsByClosePeriod: { [key: string]: any[] } = {};
    const today = new Date();

    openDeals.forEach((deal) => {
      if (!deal.properties.closedate) return;

      const closeDate = new Date(deal.properties.closedate);
      let periodKey;

      switch (period) {
        case "monthly":
          periodKey = `${closeDate.getUTCFullYear()}-${(closeDate.getUTCMonth() + 1).toString().padStart(2, "0")}`;
          break;
        case "quarterly":
          const quarter = Math.floor(closeDate.getUTCMonth() / 3) + 1;
          periodKey = `${closeDate.getUTCFullYear()}-Q${quarter}`;
          break;
        case "yearly":
          periodKey = closeDate.getUTCFullYear().toString();
          break;
      }

      if (!dealsByClosePeriod[periodKey]) {
        dealsByClosePeriod[periodKey] = [];
      }

      dealsByClosePeriod[periodKey].push(deal);
    });

    // Generate forecast periods
    const forecast = [];
    let currentDate = new Date();

    for (let i = 0; i < numberOfPeriods; i++) {
      let periodKey;
      let periodLabel;
      let nextDate;

      switch (period) {
        case "monthly":
          periodKey = `${currentDate.getUTCFullYear()}-${(currentDate.getUTCMonth() + 1).toString().padStart(2, "0")}`;
          periodLabel = `${currentDate.toLocaleString("default", { month: "long" })} ${currentDate.getUTCFullYear()}`;
          nextDate = new Date(currentDate);
          nextDate.setMonth(currentDate.getMonth() + 1);
          break;
        case "quarterly":
          const quarter = Math.floor(currentDate.getUTCMonth() / 3) + 1;
          periodKey = `${currentDate.getUTCFullYear()}-Q${quarter}`;
          periodLabel = `Q${quarter} ${currentDate.getUTCFullYear()}`;
          nextDate = new Date(currentDate);
          nextDate.setMonth(currentDate.getMonth() + 3);
          break;
        case "yearly":
          periodKey = currentDate.getUTCFullYear().toString();
          periodLabel = periodKey;
          nextDate = new Date(currentDate);
          nextDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }

      // Calculate expected revenue from open deals for this period
      const periodDeals = dealsByClosePeriod[periodKey] || [];
      let expectedRevenueFromOpenDeals = 0;

      periodDeals.forEach((deal) => {
        if (deal.properties.amount) {
          const amount = parseFloat(deal.properties.amount);
          const probability = deal.properties.hs_probability ? parseFloat(deal.properties.hs_probability) / 100 : avgWinRate;

          expectedRevenueFromOpenDeals += amount * probability;
        }
      });

      // Combine historical average with open pipeline
      const forecastedRevenue = avgRevenuePerPeriod * 0.7 + expectedRevenueFromOpenDeals * 0.3;
      const forecastedDeals = avgDealsPerPeriod * 0.7 + periodDeals.length * 0.3;

      forecast.push({
        period: periodKey,
        label: periodLabel,
        forecastedRevenue,
        forecastedDeals: Math.round(forecastedDeals),
        openDealsCount: periodDeals.length,
        openDealsValue: periodDeals.reduce((sum, deal) => {
          return sum + (deal.properties.amount ? parseFloat(deal.properties.amount) : 0);
        }, 0),
        historicalAvgRevenue: avgRevenuePerPeriod,
        confidence: i === 0 ? "High" : i === 1 ? "Medium" : "Low",
      });

      currentDate = nextDate;
    }

    return forecast;
  }
}

async function main() {
  const hubspotApiKey = process.env.HUBSPOT_API_KEY;

  if (!hubspotApiKey) {
    console.error("Please set HUBSPOT_API_KEY environment variable");
    process.exit(1);
  }

  console.error("Starting HubSpot MCP Server...");
  mcpServer = new Server(
    {
      name: "HubSpot MCP Server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const hubspotClient = new HubSpotClient(hubspotApiKey);

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    console.error("Received CallToolRequest:", request);
    try {
      if (!request.params.arguments) {
        throw new Error("No arguments provided");
      }

      switch (request.params.name) {
        case "hubspot_search_contacts": {
          const args = request.params.arguments as unknown as SearchContactsArgs;
          if (!args.query) {
            throw new Error("Missing required argument: query");
          }
          const response = await hubspotClient.searchContacts(args.query, args.count, args.propertyList);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_contact": {
          const args = request.params.arguments as unknown as GetContactArgs;
          if (!args.contactId) {
            throw new Error("Missing required argument: contactId");
          }
          const response = await hubspotClient.getContact(args.contactId, args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_create_contact": {
          const args = request.params.arguments as unknown as CreateContactArgs;
          if (!args.properties || !args.properties.email) {
            throw new Error("Missing required arguments: properties including email");
          }
          const response = await hubspotClient.createContact(args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_update_contact": {
          const args = request.params.arguments as unknown as UpdateContactArgs;
          if (!args.contactId || !args.properties) {
            throw new Error("Missing required arguments: contactId and properties");
          }
          const response = await hubspotClient.updateContact(args.contactId, args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_list_deals": {
          const args = request.params.arguments as unknown as ListDealsArgs;
          const response = await hubspotClient.listDeals(args.limit, args.after, args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_deal": {
          const args = request.params.arguments as unknown as GetDealArgs;
          if (!args.dealId) {
            throw new Error("Missing required argument: dealId");
          }
          const response = await hubspotClient.getDeal(args.dealId, args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_create_deal": {
          const args = request.params.arguments as unknown as CreateDealArgs;
          if (!args.properties || !args.properties.dealname) {
            throw new Error("Missing required arguments: properties including dealname");
          }
          const response = await hubspotClient.createDeal(args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_update_deal": {
          const args = request.params.arguments as unknown as UpdateDealArgs;
          if (!args.dealId || !args.properties) {
            throw new Error("Missing required arguments: dealId and properties");
          }
          const response = await hubspotClient.updateDeal(args.dealId, args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_list_companies": {
          const args = request.params.arguments as unknown as ListCompaniesArgs;
          const response = await hubspotClient.listCompanies(args.limit, args.after, args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_company": {
          const args = request.params.arguments as unknown as GetCompanyArgs;
          if (!args.companyId) {
            throw new Error("Missing required argument: companyId");
          }
          const response = await hubspotClient.getCompany(args.companyId, args.properties);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_sales_analytics": {
          const args = request.params.arguments as unknown as GetSalesAnalyticsArgs;
          if (!args.period || !args.startDate) {
            throw new Error("Missing required arguments: period and startDate");
          }
          const response = await hubspotClient.getSalesAnalytics(
            args.period,
            args.startDate,
            args.endDate,
            args.pipeline,
            args.dealStage,
            args.dealOwner
          );
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_deal_history": {
          const args = request.params.arguments as unknown as GetDealHistoryArgs;
          if (!args.dealId) {
            throw new Error("Missing required argument: dealId");
          }
          const response = await hubspotClient.getDealHistory(args.dealId);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_deal_notes": {
          const args = request.params.arguments as unknown as GetDealNotesArgs;
          if (!args.dealId) {
            throw new Error("Missing required argument: dealId");
          }
          const response = await hubspotClient.getDealNotes(args.dealId, args.limit, args.after);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_engagements_by_deal": {
          const args = request.params.arguments as unknown as GetEngagementsByDealArgs;
          if (!args.dealId) {
            throw new Error("Missing required argument: dealId");
          }
          const response = await hubspotClient.getEngagementsByDeal(args.dealId, args.types, args.limit, args.after);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_sales_performance": {
          const args = request.params.arguments as unknown as GetSalesPerformanceArgs;
          if (!args.period || !args.startDate) {
            throw new Error("Missing required arguments: period and startDate");
          }
          const response = await hubspotClient.getSalesPerformance(args.period, args.startDate, args.endDate, args.ownerIds, args.pipeline);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_pipeline_analytics": {
          const args = request.params.arguments as unknown as GetPipelineAnalyticsArgs;
          if (!args.pipelineId || !args.period || !args.startDate) {
            throw new Error("Missing required arguments: pipelineId, period, and startDate");
          }
          const response = await hubspotClient.getPipelineAnalytics(args.pipelineId, args.period, args.startDate, args.endDate);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        case "hubspot_get_forecast_analytics": {
          const args = request.params.arguments as unknown as GetForecastAnalyticsArgs;
          if (!args.period) {
            throw new Error("Missing required argument: period");
          }
          const response = await hubspotClient.getForecastAnalytics(args.period, args.numberOfPeriods, args.pipeline);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      console.error("Error executing tool:", error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
      };
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("Received ListToolsRequest");
    return {
      tools: [
        searchContactsTool,
        getContactTool,
        createContactTool,
        updateContactTool,
        listDealsTool,
        getDealTool,
        createDealTool,
        updateDealTool,
        listCompaniesTool,
        getCompanyTool,
        getSalesAnalyticsTool,
        getDealHistoryTool,
        getDealNotesTool,
        getEngagementsByDealTool,
        getSalesPerformanceTool,
        getPipelineAnalyticsTool,
        getForecastAnalyticsTool,
      ],
    };
  });

  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  await server.connect(transport);

  console.error("HubSpot MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
import express from 'express';

const app = express();
app.use(express.json()); // Enable JSON parsing for POST requests

app.get('/', (req, res) => {
  res.send('HubSpot MCP Server is running');
});

// Add POST endpoint for MCP tool calls
app.post('/call-tool', async (req, res) => {
  const request = req.body;
  if (!request.name || !request.arguments) {
    return res.status(400).json({ error: 'Invalid request: name and arguments required' });
  }

  try {
    const result = await mcpServer.handleRequest(CallToolRequestSchema, {
      params: {
        name: request.name,
        arguments: request.arguments
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error handling call-tool request:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const expressServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server on port ${PORT} at 0.0.0.0`);
});

expressServer.keepAliveTimeout = 120000; // 120 seconds
expressServer.headersTimeout = 120000;   // 120 seconds
