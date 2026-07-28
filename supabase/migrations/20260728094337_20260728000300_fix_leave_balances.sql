-- Fix legacy leave_balances where balance is 0 but used > 0
-- This ensures users who previously took leaves don't have a negative available balance
-- now that we enforce a strict quota check (default 4).
UPDATE public.leave_balances
SET balance = 4
WHERE balance = 0;
