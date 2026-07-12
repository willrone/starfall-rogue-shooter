import importlib.util
import inspect
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / 'tools' / 'bot' / 'run_balance_cdp.py'
spec = importlib.util.spec_from_file_location('run_balance_cdp', MODULE_PATH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

FULL_MODULE_PATH = ROOT / 'tools' / 'bot' / 'run_full_weapon_cdp_benchmark.py'
full_spec = importlib.util.spec_from_file_location('run_full_weapon_cdp_benchmark', FULL_MODULE_PATH)
assert full_spec and full_spec.loader
full_module = importlib.util.module_from_spec(full_spec)
sys.modules[full_spec.name] = full_module
full_spec.loader.exec_module(full_module)


class FakeCdp:
    def __init__(self, result):
        self.result = result

    def evaluate(self, *_args, **_kwargs):
        return self.result


class BalanceCdpBaselineContractTest(unittest.TestCase):
    def test_legendary_weapons_have_their_own_target_group(self):
        for family in ('void-tearer', 'icefire-judge', 'webmaster'):
            self.assertEqual(module.WEAPON_TIER_MAP[family], 'legendary')
        self.assertIn('legendary', module.TARGETS)

    def test_fair_baseline_uses_same_seed_for_each_weapon(self):
        first = module.derive_run_seed(42, 'storm-rifle', 0, 1, per_weapon_seed=False)
        second = module.derive_run_seed(42, 'meteor-launcher-standard', 12, 1, per_weapon_seed=False)
        self.assertEqual(first, second)

    def test_per_weapon_seed_remains_available_for_stress_runs(self):
        first = module.derive_run_seed(42, 'storm-rifle', 0, 1, per_weapon_seed=True)
        second = module.derive_run_seed(42, 'meteor-launcher-standard', 12, 1, per_weapon_seed=True)
        self.assertNotEqual(first, second)
    def test_elapsed_uses_actual_combat_time_after_interrupted_bulk_tick(self):
        self.assertEqual(module.advance_elapsed(10.0, {'combatTime': 12.5}, 300), 12.5)
        self.assertEqual(module.advance_elapsed(10.0, {}, 90), 11.5)

    def test_run_weapon_once_uses_actual_elapsed_accounting(self):
        source = inspect.getsource(module.run_weapon_once)
        self.assertNotIn('for elapsed in range', source)
        self.assertIn('advance_elapsed(', source)
        self.assertIn('ran_frames = tick_real_game(', source)

    def test_standard_runner_rejects_zero_work_and_partial_weapon_sets(self):
        with self.assertRaises(ValueError):
            module.validate_run_configuration(runs=0, max_seconds=600, weapon_level=1)
        with self.assertRaises(ValueError):
            module.validate_run_configuration(runs=1, max_seconds=0, weapon_level=1)
        with self.assertRaises(ValueError):
            module.validate_run_configuration(runs=1, max_seconds=600, weapon_level=0)
        catalog = [{'id': 'storm-rifle'}, {'id': 'icefire-judge-standard'}]
        with self.assertRaises(ValueError):
            module.select_requested_weapons(catalog, ['storm-rifle', 'missing-weapon'])
        self.assertEqual([w['id'] for w in module.select_requested_weapons(catalog, ['storm-rifle'])], ['storm-rifle'])
        with self.assertRaises(ValueError):
            module.select_requested_weapons([], None)

    def test_read_state_rejects_malformed_payloads(self):
        with self.assertRaises(RuntimeError):
            module.read_state(FakeCdp('{}'))
        malformed = '{"phase":"combat","combatTime":0,"wave":1,"hp":"NaN","kills":0,"level":1}'
        with self.assertRaises(RuntimeError):
            module.read_state(FakeCdp(malformed))

    def test_run_weapon_once_read_failure_is_runtime_failure(self):
        original_start = module.start_real_run
        original_tick = module.tick_real_game
        original_read = module.read_state
        try:
            setattr(module, 'start_real_run', lambda *_args, **_kwargs: None)
            setattr(module, 'tick_real_game', lambda *_args, **_kwargs: 60)
            setattr(module, 'read_state', lambda *_args, **_kwargs: (_ for _ in ()).throw(TimeoutError('forced read timeout')))
            with self.assertRaises(RuntimeError):
                module.run_weapon_once(FakeCdp('ok'), {'id': 'storm-rifle', 'name': '冲锋枪'}, 1, 10, 43)
        finally:
            setattr(module, 'start_real_run', original_start)
            setattr(module, 'tick_real_game', original_tick)
            setattr(module, 'read_state', original_read)

    def test_modal_failure_is_not_suppressed(self):
        with self.assertRaises(RuntimeError):
            module.handle_modal_choices(FakeCdp('choice failed'), {'phase': 'level-up'})

    def test_modal_and_shop_postconditions_are_explicit(self):
        modal_source = inspect.getsource(module.handle_modal_choices)
        shop_source = inspect.getsource(module.trigger_shop)
        self.assertIn('phase unchanged', modal_source)
        self.assertIn('shop postcondition failed', modal_source)
        self.assertIn("g.cs.phase==='shop'", shop_source)

    def test_full_runner_rejects_zero_work_and_has_progress_guard(self):
        with self.assertRaises(ValueError):
            full_module.validate_benchmark_configuration([], runs=0, max_seconds=0, step_seconds=0, canonical=False)
        canonical = [{'id': f'w{i}'} for i in range(17)]
        full_module.validate_benchmark_configuration(canonical, runs=1, max_seconds=600, step_seconds=1, canonical=True)
        with self.assertRaises(ValueError):
            full_module.validate_benchmark_configuration(canonical, runs=2, max_seconds=600, step_seconds=1, canonical=True)
        source = inspect.getsource(full_module._run_one)
        main_source = inspect.getsource(full_module.main)
        self.assertIn('max_iterations', source)
        self.assertIn('insufficient combat-time progress', source)
        self.assertIn('canonical=CANONICAL', main_source)

    def test_required_offhand_and_shop_fail_closed(self):
        with self.assertRaises(RuntimeError):
            module.select_offhand_runtime(FakeCdp('synth failed'))
        with self.assertRaises(RuntimeError):
            module.trigger_shop(FakeCdp('shop phase=combat'))

    def test_summary_error_fails_full_benchmark(self):
        self.assertEqual(full_module.benchmark_failed_ids([], 'summary failed'), ['summary'])


if __name__ == '__main__':
    unittest.main()
