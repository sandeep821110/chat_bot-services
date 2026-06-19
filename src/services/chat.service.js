const PRODUCT_API = process.env.PRODUCT_SERVICE_URL || 'http://localhost:4001/api/products';

const GREETINGS = [/^(hi|hello|hey|namaste|good morning|good afternoon|good evening|yo|sup)\b/i];
const FAREWELLS = [/^(bye|goodbye|see you|thanks?|thank you|that'?s all|i'?m done)\b/i];

const PATTERNS = {
  category: /\b(men|women|kids|man|woman|male|female|child|boy|girl|unisex)\b/i,
  subCategory: /\b(t-shirt|tshirt|shirt|jeans|dress|saree|kurta|shorts|trouser|pant|jacket|blazer|sweater|hoodie|leggings|skirt|top|ethnic|western|formal|casual|sportswear|footwear|shoe|sandal|sneaker)\b/i,
  budget: /(?:under|below|less than|within|above|over|more than|min|max|between)?\s*(?:rs\.?\s*|₹|inr\s*)?(\d{3,7})(?:\s*(?:and|to|-)\s*(?:rs\.?\s*|₹|inr\s*)?(\d{3,7}))?/i,
  bodyType: /\b(hourglass|pear|apple|rectangle|inverted|broad shoulder|wide hip)\b/i,
  occasion: /\b(party|wedding|function|office|work|business|date|club|beach|vacation|travel|gym|sport|college|festival|diwali|puja|marriage|cocktail|dinner|lunch)\b/i,
  trending: /\b(bestseller|trending|popular|top|hot)\b/i,
  color: /\b(red|blue|black|white|green|yellow|pink|purple|orange|grey|gray|navy|maroon|brown|beige|teal)\b/i,
};

const BODY_TYPE_TIPS = {
  hourglass: 'Fitted silhouettes and wrap dresses highlight your balanced proportions perfectly!',
  pear: 'A-line skirts and wide-leg pants balance your lower half beautifully. Try off-shoulder tops!',
  apple: 'Empire waistlines and V-necks create a lengthening effect. Flowy fabrics are your friend!',
  rectangle: 'Belted waists and peplum tops create curves. Try structured blazers too!',
  inverted_triangle: 'Wide-leg pants and A-line skirts balance broad shoulders. V-necks work great!',
};

const OCCASION_MOOD = {
  party: 'party', wedding: 'formal', function: 'formal',
  office: 'formal', work: 'formal', business: 'formal',
  date: 'party', club: 'party', beach: 'casual',
  vacation: 'casual', travel: 'casual', gym: 'sporty',
  sport: 'sporty', college: 'casual', festival: 'ethnic',
  diwali: 'ethnic', puja: 'ethnic', marriage: 'formal',
  cocktail: 'party', dinner: 'formal', lunch: 'casual',
};

const GREETING_RESPONSE = {
  text: "Hello! I'm your ChooseMood fashion assistant. I can help you find the perfect outfit, suggest products within your budget, or give style advice. What are you looking for today?",
  products: [],
  suggestions: [
    'Show me bestsellers',
    'I need a party outfit',
    'Budget under ₹2000',
    "What's trending?",
    'Helpline number',
  ],
};

const FAREWELL_RESPONSE = {
  text: "You're welcome! Come back anytime you need fashion advice. Happy styling!",
  products: [],
  suggestions: ['Show me bestsellers', 'I need a party outfit', "Hi, I'm back!"],
};

function extractNumbers(msg) {
  return msg.match(/\d+/g)?.map(Number) || [];
}

function extractBudget(msg) {
  const nums = extractNumbers(msg);
  if (nums.length === 0) return null;
  const lower = msg.toLowerCase();
  if (/\b(under|below|less than|within|upto|up to|max|maximum)\b/.test(lower)) {
    return { min: 0, max: nums[0] };
  }
  if (/\b(above|over|more than|min|minimum)\b/.test(lower)) {
    return { min: nums[0], max: 999999 };
  }
  if (nums.length >= 2) {
    return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  }
  return { min: Math.max(0, nums[0] - 500), max: nums[0] + 500 };
}

function match(msg, regex) {
  const m = msg.match(regex);
  return m ? m[1] || m[0] : null;
}

function categoryMapper(cat) {
  const map = { man: 'Men', male: 'Men', woman: 'Women', female: 'Women', child: 'Kids', boy: 'Kids', girl: 'Kids', kids: 'Kids' };
  return map[cat.toLowerCase()] || cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
}

function subCategoryMapper(sc) {
  const map = { tshirt: 'T-Shirts', 't-shirt': 'T-Shirts', shoe: 'Footwear', shoes: 'Footwear', sneaker: 'Footwear', sandal: 'Footwear', pant: 'Pants', trouser: 'Trousers' };
  return map[sc.toLowerCase()] || sc.charAt(0).toUpperCase() + sc.slice(1).toLowerCase();
}

function formatProduct(raw) {
  return {
    id: raw._id || raw.id,
    name: raw.name,
    price: raw.price,
    discountPrice: raw.discountPrice ?? raw.price,
    category: raw.category,
    subCategory: raw.subCategory,
    rating: raw.rating || 0,
    image: (raw.images || [])[0] || '',
    brand: raw.brand || '',
  };
}

async function fetchProducts(filters = {}) {
  const params = new URLSearchParams({ limit: '8', page: '1' });
  if (filters.category) params.set('category', filters.category);
  if (filters.subCategory) params.set('subCategory', filters.subCategory);
  if (filters.minPrice != null) params.set('minPrice', filters.minPrice);
  if (filters.maxPrice != null) params.set('maxPrice', filters.maxPrice);
  if (filters.search) params.set('search', filters.search);
  if (filters.bestseller) params.set('bestseller', 'true');
  if (filters.limit) params.set('limit', filters.limit);

  try {
    const res = await fetch(`${PRODUCT_API}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const body = await res.json();
    const items = body.data || body.products || [];
    return items.map(formatProduct);
  } catch {
    return [];
  }
}

function buildResponse(products, contextMsg = '') {
  if (!products || products.length === 0) {
    return {
      text: "Sorry, I couldn't find any products matching that right now. Could you try a different search?",
      products: [],
      suggestions: ['Show me bestsellers', 'I want casual wear', 'Party outfits'],
    };
  }

  const names = products.slice(0, 3).map(p => p.name).join(', ');
  const text = contextMsg
    ? `${contextMsg}\n\n${names}${products.length > 3 ? ` and ${products.length - 3} more` : ''}`
    : `Here are ${products.length} items I found:\n\n${names}${products.length > 3 ? ` and ${products.length - 3} more` : ''}`;

  const suggestions = ['Show under ₹1500', 'Show best rated'];
  if (products.some(p => p.category === 'Men')) suggestions.push("Show women's collection");
  if (products.some(p => p.category === 'Women')) suggestions.push("Show men's collection");

  return { text, products: products.slice(0, 6), suggestions: suggestions.slice(0, 4) };
}

export async function processMessage(message, context = {}) {
  const msg = message.trim();
  if (!msg) {
    return { text: 'Please say something!', products: [], suggestions: ['Hi', 'Show products'] };
  }

  if (GREETINGS.some(g => g.test(msg))) {
    const name = context.name || '';
    return { ...GREETING_RESPONSE, text: name ? `Hi ${name}! ${GREETING_RESPONSE.text}` : GREETING_RESPONSE.text };
  }

  if (FAREWELLS.some(f => f.test(msg))) {
    return FAREWELL_RESPONSE;
  }

  if (/\b(helpline|support|customer care|contact|phone number|call|help line|toll.?free)\b/i.test(msg)) {
    return {
      text: "Here's how to reach us:\n\n📞 Helpline: +91 98765 43210 (Mon-Sat, 10am-7pm)\n✉️ Email: support@choosemood.in (24/7)\n💬 Or visit our Contact page to raise a query.\n\nHow else can I help you?",
      products: [],
      suggestions: ['Show bestsellers', 'I need a party outfit', 'Track my order'],
    };
  }

  const bodyTypeMatch = match(msg, PATTERNS.bodyType);
  if (bodyTypeMatch) {
    const bt = bodyTypeMatch.toLowerCase().replace(/\s+/g, '_');
    const tip = BODY_TYPE_TIPS[bt] || 'Every body type is unique and beautiful!';
    return {
      text: `Great style advice for ${bt.replace(/_/g, ' ')} body type: ${tip} Would you like me to show you some outfits?`,
      products: [],
      suggestions: ['Show outfits for my body type', 'Show top recommendations', 'What colors suit me?'],
    };
  }

  const budget = extractBudget(msg);
  const categoryMatch = match(msg, PATTERNS.category);
  const subCategoryMatch = match(msg, PATTERNS.subCategory);
  const occasionMatch = match(msg, PATTERNS.occasion);
  const isTrending = PATTERNS.trending.test(msg);

  const filters = {};
  const contextParts = [];

  if (occasionMatch) {
    contextParts.push(`For a ${occasionMatch.toLowerCase()} look`);
  }

  if (categoryMatch) {
    filters.category = categoryMapper(categoryMatch);
    contextParts.push(`in ${filters.category}'s collection`);
  }

  if (subCategoryMatch) {
    filters.subCategory = subCategoryMapper(subCategoryMatch);
    contextParts.push(`in ${filters.subCategory}`);
  }

  if (budget) {
    filters.minPrice = budget.min;
    filters.maxPrice = budget.max;
    contextParts.push(`between ₹${budget.min.toLocaleString('en-IN')} - ₹${budget.max.toLocaleString('en-IN')}`);
  }

  if (isTrending) {
    filters.bestseller = true;
    contextParts.push('bestselling');
  }

  if (Object.keys(filters).length === 0) {
    filters.limit = 6;
  }

  let products = await fetchProducts(filters);

  if (budget) {
    products.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
  }

  const contextMsg = contextParts.length > 0 ? `Here are some great options ${contextParts.join(', ')}:` : '';
  return buildResponse(products, contextMsg);
}

export async function getTrending() {
  const products = await fetchProducts({ bestseller: true, limit: 6 });
  return products;
}

export async function getPriceInsights() {
  const products = await fetchProducts({ limit: 20 });

  if (!products || products.length === 0) {
    return { text: 'Product pricing data is not available right now. Check back later!', products: [] };
  }

  const prices = products.map(p => p.discountPrice || p.price).filter(Boolean);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return {
    text: `Price Insights\n- Average price: ₹${avg.toLocaleString('en-IN')}\n- Budget-friendly: Under ₹${(min + 500).toLocaleString('en-IN')}\n- Premium range: Above ₹${(max - 1000).toLocaleString('en-IN')}\n\nWould you like me to show products in a specific range?`,
    products: products.slice(0, 4),
    suggestions: ['Show under ₹1000', 'Show between ₹1000-₹3000', 'Show premium collection'],
  };
}
