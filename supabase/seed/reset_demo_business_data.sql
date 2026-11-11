-- =====================================================================
-- reset_demo_business_data.sql
-- Clears the BUSINESS data of the base-catalog company "AluPro Demo" so its
-- dashboard starts from zero. Keeps: tenants, users/memberships/profiles,
-- model_pricing + model_components (the catalog), quote_templates (+
-- components), company_headers, partners, agent_settings.
--
-- Hard delete, scoped to a single tenant id in every statement. NOT part of
-- the migrations: run by hand, once, after reviewing the counts below.
-- Files uploaded to Storage (project-files bucket) are NOT removed here.
--
-- Step 1 (read-only): run the counts and look at them.
-- Step 2: run the transaction.
-- =====================================================================

-- ---- Step 1: counts (read-only) ----
select 'customers' as tbl, count(*) from public.customers where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'projects', count(*) from public.projects where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'project_quotes', count(*) from public.project_quotes where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'quote_items', count(*) from public.quote_items where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'quote_item_components', count(*) from public.quote_item_components where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'client_payments', count(*) from public.client_payments where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'supplier_orders', count(*) from public.supplier_orders where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'material_orders', count(*) from public.material_orders where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'material_order_items', count(*) from public.material_order_items where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'documents', count(*) from public.documents where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'reminders', count(*) from public.reminders where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'general_expenses', count(*) from public.general_expenses where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1'
union all select 'agent_alerts', count(*) from public.agent_alerts where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';

-- ---- Step 2: delete (children first) ----
begin;

delete from public.material_order_items       where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.material_orders            where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.quote_item_components      where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.quote_items                where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.project_quotes             where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.client_payments            where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.supplier_orders            where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.documents                  where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.reminders                  where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.general_expenses           where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.agent_alerts               where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.projects                   where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';
delete from public.customers                  where tenant_id = '0fb62128-e262-4541-90e0-144e1820d0a1';

commit;
