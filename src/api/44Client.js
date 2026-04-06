// WICHTIG: Kein Import von createClient, da es automatisch 44.auth.me() aufruft
// Wir bauen einen minimalen Client nur für 44.functions.invoke

export const base44 = {
  functions: {
    invoke: async (functionName, payload = {}) => {
      const API_BASE_URL = 'https://desponexodriver.app';
      const response = await fetch(`${API_BASE_URL}/functions/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Function ${functionName} failed: ${response.statusText}`);
      }

      return response.json();
    }
  }
};
