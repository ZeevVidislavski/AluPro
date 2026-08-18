import {
  ProjectQuoteService,
  QuoteItemService,
  QuoteItemComponentService,
  ModelComponentService,
  MaterialOrderService,
  MaterialOrderItemService,
} from "@/services";

// component_type → order_type mapping
const TYPE_MAP = {
  profile: "profiles",
  hardware: "hardware",
  glass: "glass",
};

/**
 * Generate material orders for a project from its model components.
 * - Loads all QuoteItems for the project, then their QuoteItemComponents,
 *   resolves ModelComponent data, groups by order type & item_code, aggregates.
 * - Deletes existing draft orders for this project first (regenerate).
 */
export async function generateMaterialOrders(projectId, projectName) {
  // 1. Load all quote items for this project
  const quotes = await ProjectQuoteService.listByProject(projectId);
  if (!quotes.length) throw new Error("אין הצעות מחיר לפרויקט זה");

  const allQuoteItems = (
    await Promise.all(quotes.map(q => QuoteItemService.listByQuote(q.id)))
  ).flat();

  if (!allQuoteItems.length) throw new Error("אין פריטים בהצעות המחיר");

  // 2. Load QuoteItemComponents to find which catalog items are used
  const allQuoteItemComponents = await QuoteItemComponentService.listByQuoteItems(
    allQuoteItems.map(qi => qi.id)
  );

  // 3. For each quote item we need its dimensions to calculate lengths
  const quoteItemMap = Object.fromEntries(allQuoteItems.map(qi => [qi.id, qi]));

  // 4. Load all ModelComponents referenced by catalog_item_ids
  const catalogItemIds = [...new Set(allQuoteItemComponents.map(c => c.catalog_item_id).filter(Boolean))];
  if (!catalogItemIds.length) throw new Error("אין רכיבי קטלוג מקושרים לפריטי ההצעה");

  const allModelComponents = (
    await Promise.all(catalogItemIds.map(id => ModelComponentService.listByModel(id)))
  ).flat();

  if (!allModelComponents.length) throw new Error("אין רכיבי ייצור מוגדרים לדגמים בפרויקט זה");

  // Build map: catalog_item_id → [ModelComponent]
  const modelCompsByModel = {};
  for (const mc of allModelComponents) {
    if (!modelCompsByModel[mc.model_id]) modelCompsByModel[mc.model_id] = [];
    modelCompsByModel[mc.model_id].push(mc);
  }

  // 5. Aggregate: group by (order_type, item_code)
  // aggregation[order_type][item_code] = { total_quantity, total_length }
  const aggregation = {};

  for (const qic of allQuoteItemComponents) {
    if (!qic.catalog_item_id) continue;
    const modelComps = modelCompsByModel[qic.catalog_item_id] || [];
    if (!modelComps.length) continue;

    const quoteItem = quoteItemMap[qic.quote_item_id];
    const lineQty = quoteItem?.quantity || 1; // number of windows/units in this line

    for (const mc of modelComps) {
      const orderType = TYPE_MAP[mc.component_type];
      if (!orderType) continue; // skip "accessory" etc.

      if (!aggregation[orderType]) aggregation[orderType] = {};
      if (!aggregation[orderType][mc.item_code]) {
        aggregation[orderType][mc.item_code] = { total_quantity: 0, total_length: 0 };
      }

      const entry = aggregation[orderType][mc.item_code];
      const compQty = (mc.quantity || 1) * lineQty;
      entry.total_quantity += compQty;

      // For profiles: add length × quantity
      if (orderType === "profiles" && mc.calculated_length) {
        entry.total_length += mc.calculated_length * compQty;
      }
    }
  }

  if (!Object.keys(aggregation).length) throw new Error("לא נמצאו רכיבים להזמנה");

  // 6. Delete existing draft orders for this project
  const existingOrders = await MaterialOrderService.listByProject(projectId);
  await Promise.all(existingOrders.map(o => MaterialOrderService.delete(o.id)));

  // 7. Create new MaterialOrders + Items
  const createdOrders = [];
  for (const [orderType, itemMap] of Object.entries(aggregation)) {
    const order = await MaterialOrderService.create({
      project_id: projectId,
      project_name: projectName,
      order_type: orderType,
      status: "draft",
    });

    const items = Object.entries(itemMap).map(([item_code, vals]) => ({
      material_order_id: order.id,
      item_code,
      total_quantity: Math.round(vals.total_quantity * 100) / 100,
      total_length: vals.total_length ? Math.round(vals.total_length * 100) / 100 : null,
    }));

    await Promise.all(items.map(item => MaterialOrderItemService.create(item)));
    createdOrders.push(order);
  }

  return createdOrders;
}
