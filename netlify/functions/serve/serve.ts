import { join } from "path";
import { builder, HandlerResponse } from "@netlify/functions";
import etag from "etag";
import type { IGatsbyPage } from "../../../.cache/query-engine";

import {
  prepareFilesystem,
  TEMP_CACHE_DIR,
  getPagePathFromPageDataPath,
  getGraphQLEngine,
} from "../../../src/utils";

prepareFilesystem(["data", "page-ssr", "query-engine"]);

const { getData, renderHTML, renderPageData } = require(join(
  TEMP_CACHE_DIR,
  "page-ssr"
));

const DATA_SUFFIX = "/page-data.json";
const DATA_PREFIX = "/page-data/";

const render = async (eventPath: string): Promise<HandlerResponse> => {
  const isPageData =
    eventPath.endsWith(DATA_SUFFIX) && eventPath.startsWith(DATA_PREFIX);

  const pathName = isPageData
    ? getPagePathFromPageDataPath(eventPath)
    : eventPath;

  const graphqlEngine = getGraphQLEngine();
  const page: IGatsbyPage & { mode?: string } =
    graphqlEngine.findPageByPath(pathName);

  if (page && page.mode === `DSR`) {
    const data = await getData({
      pathName,
      graphqlEngine,
    });

    if (isPageData) {
      const body = JSON.stringify(await renderPageData({ data }));
      return {
        statusCode: 200,
        body,
        headers: {
          ETag: etag(body),
          "Content-Type": "application/json",
        },
      };
    }

    const body = await renderHTML({ data });

    return {
      statusCode: 200,
      body,
      headers: {
        ETag: etag(body),
        "Content-Type": "text/html; charset=utf-8",
      },
    };
  }

  return {
    statusCode: 404,
    body: `Page not found`,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  };
};

exports.handler = builder(async function handler(event, context) {
  return render(event.path);
});
