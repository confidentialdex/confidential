import { GraphQLClient } from 'graphql-request'

export const GOLDSKY_URL = 'https://api.goldsky.com/api/public/project_cmq6wbchslca901xaekhtfer7/subgraphs/v1/1.2.0/gn'

export const gqlClient = new GraphQLClient(GOLDSKY_URL)
