import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import type { Category, Product } from "@/lib/types";
import { mapProduct, type ProductRow } from "./map";

const SELECT_PRODUCT = `
  id, slug, name, hindi_name, category, description, price, mrp, unit,
  image_urls, video_url, stock, active, featured, created_at, updated_at
`;

export const listProducts = createServerFn({ method: "GET" })
  .validator((data?: { category?: Category; includeHidden?: boolean }) => data ?? {})
  .handler(async ({ data }) => {
    const sql = await getSql();
    const category = data.category;
    const includeHidden = Boolean(data.includeHidden);
    let rows: ProductRow[];
    if (category && includeHidden) {
      rows = await sql.query<ProductRow>(
        `select ${SELECT_PRODUCT} from products where category = $1 order by featured desc, name asc`,
        [category],
      );
    } else if (category) {
      rows = await sql.query<ProductRow>(
        `select ${SELECT_PRODUCT} from products where category = $1 and active = true order by featured desc, name asc`,
        [category],
      );
    } else if (includeHidden) {
      rows = await sql.query<ProductRow>(
        `select ${SELECT_PRODUCT} from products order by featured desc, name asc`,
      );
    } else {
      rows = await sql.query<ProductRow>(
        `select ${SELECT_PRODUCT} from products where active = true order by featured desc, name asc`,
      );
    }
    return rows.map(mapProduct) as Product[];
  });

export const getProductBySlug = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await getSql();
    const rows = await sql.query<ProductRow>(
      `select ${SELECT_PRODUCT} from products where slug = $1 limit 1`,
      [slug],
    );
    return rows[0] ? mapProduct(rows[0]) : null;
  });
