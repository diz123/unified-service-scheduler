Scenario A: The Unified Service Scheduler
• Domain: Ownership
• Task: Build an Appointment Scheduler application to replace manual booking
systems.
• Core Requirements:
1. Resource Constrained Booking: Allow a user to request a service
appointment for a specific vehicle, service type, and dealership at a
desired time.
2. Real-Time Availability Check: Before confirming, check for the
availability of both a ServiceBay and a qualified Technician for the entire
service duration.
3. Confirmed Appointment Record: Upon success, create a persistent
Appointment record associating the customer, vehicle, technician, and
service bay.


---

## Challenge Structure (common to all scenarios)

Copied verbatim from the challenge document. Only line wrapping and the PDF page footer (page number, version, copyright line) were removed.

### The Challenge Structure

Your work should be based on the single scenario you chose.

### Part 1: System Design

Produce a System Design Document that outlines your architectural plan. You are free to choose the format (e.g., Markdown, PDF, diagram). This document should include:

- An architecture diagram.
- A brief description of each component's role.
- An explanation of the data flow.
- A list of your chosen technologies with justifications.
- Your strategy for observability (e.g., logging, metrics, tracing).
- A dedicated section describing how you used GenAI to assist in the design phase.

### Part 2: Service Implementation (Your Choice)

Choose one service layer to implement fully: either the backend or the frontend and mock or stub the other. Your implementation should fulfil the acceptance criteria of your chosen scenario for the service layer you select.

- If you choose Backend: Expose a RESTful API and use a persistent database. Mock or stub the client-side layer with a simple test harness, cURL examples, or a basic API contract (e.g., OpenAPI spec).
- If you choose Frontend: Build a web application that demonstrates the full user experience for your scenario. Mock the backend layer using static data, a mock API library, or a local JSON server.
- Build For the Future: Whichever layer you choose, your design and implementation should consider scalability, performance, reliability, maintainability, and observability.

### Deliverables & Submission

Please submit the following three artifacts:

1. System Design Document: Your architectural plan.
2. Working Code: A Git repository containing your chosen service implementation. It must include:
   - A README.md with clear instructions on how to build, run, and test your application.
   - A dedicated section in the README for your AI Collaboration Narrative. Describe your high-level strategy for guiding the AI, your process for verifying and refining its output, and how you ensured the final quality of the code.
   - A suite of tests that validate the core business logic.
3. Video Submission (5-10 minutes): A short video presentation covering:
   - A brief introduction to yourself and your chosen scenario.
   - A walkthrough of your system design and implementation highlights.
   - A summary of your AI collaboration story (1-2 minutes).
   - A brief demonstration of your application.
   - What you learned and any challenges you faced.

### Evaluation Framework

We will be evaluating your submission across four key dimensions:

1. Problem Solving & System Design: The clarity, logic, and foresight of your architecture.
2. Technical Execution: The quality, correctness, and testing of your implementation.
3. AI Engineering & Verification: Your strategy for directing AI and your process for verifying, debugging, and owning the final solution.
4. Communication & Presentation: The clarity and professionalism of your documentation and video.

We are excited to see what you build. Good luck!
