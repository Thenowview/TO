"""Website capability discovery must never imply provider authorization."""
import unittest
from engine import website_integrations

class WebsiteCatalogTests(unittest.TestCase):
    def test_offline_catalog_is_read_only_and_discloses_third_party(self):
        result=website_integrations.catalog()
        self.assertFalse(result['external_calls_made'])
        self.assertTrue(result['local_endpoint_only'])
        self.assertEqual(result['schema'],'theorg-website-integrations-v1')
        providers={p['id']:p for p in result['providers']}
        self.assertEqual(providers['local_workspace']['status'],'local_ui')
        self.assertEqual(providers['the_org_data']['group'],'third_party')
        self.assertEqual(providers['the_org_data']['cost'],'potentially_metered')
        self.assertTrue(all(p['connected'] is None and not p['live_probed'] and not p['data_sent'] for p in providers.values()))
        self.assertEqual(providers['cloudflare']['status'],'not_implemented')
    def test_returns_independent_mutable_copies(self):
        one=website_integrations.catalog()
        one['providers'][0]['capabilities'].clear()
        two=website_integrations.catalog()
        self.assertTrue(two['providers'][0]['capabilities'])
