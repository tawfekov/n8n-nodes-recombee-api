![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-recombee

This is an n8n community node that lets you integrate [Recombee's AI-powered recommendation engine](https://www.recombee.com/?ref=n8n-nodes-recombee-api) into your n8n workflows. Recombee provides powerful personalization capabilities for various use cases including e-commerce, content recommendations, and more.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

This package includes the following nodes:

### User Management Nodes

#### Add User

Creates a new user in your Recombee database. Users are specified using unique string identifiers that can contain digits, Latin letters, underscores, colons, minus signs, at signs, and dots.

#### Delete User

Removes a user from your Recombee database. If the user has any interactions (purchases, ratings, bookmarks, cart additions, or detail views), they will be deleted in cascade.

#### Set User Values

Sets or updates properties for a specific user. Properties can include any user-related information like preferences, demographics, or behavioral data.

### Item Management Nodes

#### Add Item

Adds a new item to your Recombee catalog. Items are specified using unique string identifiers with the same format as user IDs.

#### Delete Item

Removes an item from your catalog. All associated interactions and series entries will be deleted in cascade. For items that are no longer available but should be kept for historical data, use ReQL filters instead of deletion.

#### Set Item Values

Sets or updates properties for a specific item. Properties can include product details, categories, prices, and any other item-related information.

### Interaction Tracking Nodes

#### Add Detail View

Records when a user views an item. This is used to track user interest and build viewing history.

#### Add Purchase

Records when a user purchases an item. This is a strong signal for recommendation algorithms.

#### Add Rating

Records a user's explicit rating for an item. Ratings can be used to improve recommendation accuracy.

#### Add Cart Addition

Records when a user adds an item to their shopping cart. This helps track purchase intent.

### Recommendation Nodes

#### Recommend Items to User

Generates personalized item recommendations for a specific user based on their interaction history and preferences.

#### Recommend Items to Item

Finds items similar to a given item, useful for "similar items" or "you might also like" features.

#### Recommend Items to Item Segment

Recommends items to users based on item segments, useful for category-based recommendations.

#### Recommend Next Items

Suggests the next items in a sequence, useful for content consumption or learning paths.

### Search Nodes

#### Search Items

Performs a search across your item catalog with support for filtering and boosting.

#### Search Item Segments

Searches through item segments with similar capabilities to item search.

### Batch Operations

#### Batch

Executes multiple requests in a single API call. Limited to 10,000 requests server-side and 30 requests client-side.

## Credentials

To use these nodes, you need:

1. A Recombee account (sign up at [recombee.com](https://www.recombee.com/))
2. Your Recombee database ID
3. Your Recombee secret token

You can find these credentials in your Recombee dashboard under the API section.

## Compatibility

- Latest n8n version: 1.93
- Tested with n8n versions: 1.93
- Requires Node.js version 20 or higher

## Usage

### Basic Data Synchronization

#### User Synchronization

This workflow syncs user data from your system to Recombee:

1. Trigger: Schedule (daily sync) or Webhook (when user data changes)
2. Set User Values
   ```json
   {
   	"userId": "user123",
   	"values": {
   		"name": "John Doe",
   		"email": "john@example.com",
   		"preferences": ["electronics", "books"],
   		"lastActive": "2024-03-20T10:00:00Z",
   		"subscriptionTier": "premium"
   	}
   }
   ```

#### Product/Item Synchronization

This workflow syncs product catalog from your system to Recombee:

1. Trigger: Schedule (daily sync) or Webhook (when product data changes)
2. Set Item Values
   ```json
   {
   	"itemId": "product123",
   	"values": {
   		"name": "Wireless Headphones",
   		"category": "electronics",
   		"price": 199.99,
   		"brand": "TechBrand",
   		"inStock": true,
   		"tags": ["audio", "wireless", "bluetooth"],
   		"lastUpdated": "2024-03-20T10:00:00Z"
   	}
   }
   ```

### Basic Recommendation Workflow

1. Add a Recombee credential
2. Use the "Add User" node to create a user
3. Use the "Add Item" node to add items to your catalog
4. Use interaction nodes to record user behavior
5. Use recommendation nodes to get personalized suggestions

### Example Workflows

#### 1. Content Recommendation System

This workflow helps an AI agent recommend relevant content to users:

1. Trigger: Webhook (when user requests content recommendations)
2. Get User (retrieve user profile)
3. Recommend Items to User (get personalized content suggestions)
   - Use `scenario` parameter to specify recommendation context
   - Use `filter` to exclude already viewed content
4. HTTP Request (send recommendations to AI agent)
5. AI Agent processes recommendations and generates personalized response

#### 2. E-commerce Product Discovery

This workflow enables an AI shopping assistant to help users find products:

1. Trigger: Webhook (when user views a product page)
2. Add Detail View (record current product view)
3. Recommend Items to Item (find related products)
   - Use `targetUserId` to personalize based on user history
   - Use `filter` to exclude out-of-stock items
4. AI Agent combines results to provide comprehensive recommendations

#### 3. Content Personalization Engine

This workflow helps an AI agent personalize content delivery:

1. Trigger: Schedule (daily content update)
2. Recommend Items to Item Segment (find content for specific segments)
   - Use `scenario` to specify different recommendation strategies
   - Use `filter` to apply business rules
3. AI Agent analyzes trends and generates personalized content strategy

#### 4. User Behavior Analysis

This workflow helps an AI agent understand user preferences:

1. Trigger: Webhook (when user interacts with content)
2. Add Detail View (record the interaction)
3. Add Rating (if user provides feedback)
4. List User Detail Views (analyze user behavior)
5. AI Agent analyzes behavior patterns and adjusts recommendations

#### 5. Multi-Channel Recommendation System

This workflow enables an AI agent to provide consistent recommendations across platforms:

1. Trigger: Webhook (when user interacts on any platform)
2. Add Detail View (record the interaction)
3. Recommend Items to User (get personalized suggestions)
   - Use `scenario` to specify platform-specific recommendations
   - Use `filter` to ensure content availability
4. HTTP Request (sync recommendations across platforms)
5. AI Agent ensures consistent user experience

#### 6. Dynamic Content Curation

This workflow helps an AI agent curate content based on real-time trends:

1. Trigger: Schedule (hourly updates)
2. Recommend Items to Item Segment (get segment-specific content)
   - Use `scenario` to specify curation strategy
   - Use `filter` to apply content rules
3. AI Agent combines trends with user preferences for content curation

#### 7. Personalized Learning Path

This workflow helps an AI educational assistant recommend learning materials:

1. Trigger: Webhook (when user completes a lesson)
2. Add Detail View (record completed content)
3. Add Rating (record user feedback)
4. Recommend Next Items (find next learning materials)
   - Use `scenario` to specify learning path
   - Use `filter` to ensure proper difficulty level
5. AI Agent creates personalized learning path

#### 8. Smart Product Bundle Creation

This workflow helps an AI agent create personalized product bundles:

1. Trigger: Webhook (when user views a product)
2. Recommend Items to Item (find complementary products)
   - Use `scenario` to specify bundle strategy
   - Use `filter` to ensure product compatibility
3. AI Agent creates optimized product bundles

### Best Practices

1. **Interaction Tracking**:

   - Use `Add Detail View` to record when users view items
   - Use `Add Purchase` to record completed transactions
   - Use `Add Rating` to collect explicit feedback
   - Use `Add Cart Addition` to track shopping behavior

2. **Recommendation Generation**:

   - Use `Recommend Items to User` for personalized suggestions
   - Use `Recommend Items to Item` for related items
   - Use `Recommend Items to Item Segment` for segment-based recommendations
   - Use `Recommend Next Items` for sequential recommendations

3. **Rate Limiting**: Implement appropriate delays between API calls to respect Recombee's rate limits
4. **Error Handling**: Always include error handling nodes in your workflows
5. **Data Validation**: Validate user and item data before sending to Recombee
6. **Caching**: Consider caching recommendations for frequently accessed items
7. **Monitoring**: Set up monitoring for your workflows to track performance

### Integration Tips

1. **User Identification**: Maintain consistent user IDs across your system
2. **Item Properties**: Include relevant metadata with items for better recommendations
3. **Interaction Tracking**: Record all relevant user interactions for better personalization
4. **A/B Testing**: Use different recommendation strategies to optimize results
5. **Feedback Loop**: Implement mechanisms to collect user feedback on recommendations

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Recombee API Documentation](https://docs.recombee.com/api-reference.html)
- [Recombee Use Cases](https://www.recombee.com/use-cases)
- [n8n Try it out](https://docs.n8n.io/try-it-out/)
